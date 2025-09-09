import { JobsService } from "./jobs.service";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import * as substrateNodesWsEndpoints from "../../../res/substrate-nodes-ws-endpoints.json";
import { Job } from "../../model/job";
import { filter, firstValueFrom, Subject } from "rxjs";
import { determineNextJob } from "./determine-next-job";
import { AwilixContainer } from "awilix";
import { isEvmAddress } from "../data-aggregation/helper/is-evm-address";
import { logger } from "../logger/logger";
import { JobProcessor } from "./job.processor";
import { JobPostProcessor } from "./job.post-processor";
import { createJobId } from "./helper/create-job-id";
import { TaxableEvent } from "../data-aggregation/model/portfolio-movement";

const PARALLEL_POST_PROCESSING_JOBS = 2;

interface PostProcessingJob {
  id: string;
  wallet: string;
}

export class JobManager {
  private postProcessingStream = new Subject<PostProcessingJob>();
  private postProcessingQueue: PostProcessingJob[] = [];
  private postProcessingWallets = new Set<string>();

  constructor(
    private jobsService: JobsService,
    private DIContainer: AwilixContainer,
  ) {
    this.postProcessingStream.subscribe((job) => {
      this.postProcessingQueue.push(job);
      this.schedulePostProcessing();
    });
  }

  getChains(wallet: string): string[] {
    const isEvm = isEvmAddress(wallet);
    return subscanChains.chains
      .filter((c) => !c.excluded)
      .filter(
        (c) =>
          Object.keys(substrateNodesWsEndpoints).includes(c.domain) ||
          c.stakingPallets.length > 0,
      )
      .filter((c) => !isEvm || c.evmPallet || c.evmAddressSupport)
      .map((c) => c.domain);
  }

  isPolkadotApiSupported(chain: string): boolean {
    return Object.keys(substrateNodesWsEndpoints).includes(chain);
  }

  async enqueue(
    reqId: string,
    wallet: string,
    currency: string,
    syncFromDate: number,
    syncUntilDate: number,
    blockchains: string[] = [],
  ): Promise<Job[]> {
    logger.info(`Enter enqueue jobs ${reqId}, ${wallet}, ${currency}`);

    const chains = blockchains.length ? blockchains : this.getChains(wallet);
    const jobs = await this.jobsService.fetchJobs(wallet);
    const jobIds = this.getChains(wallet).map((b) => {
      return createJobId({
        blockchain: b,
        wallet,
        currency,
        syncFromDate,
        syncUntilDate,
      });
    });
    const matchingJobs = jobs.filter((j) => jobIds.includes(j.id));

    const newJobs: Job[] = [];

    for (const chain of chains) {
      const job = matchingJobs.find((j) => j.blockchain === chain);

      if (!job || job.status === "error") {
        if (job) await this.jobsService.delete(job);
        newJobs.push(
          await this.jobsService.addJob(
            reqId,
            wallet,
            chain,
            syncFromDate,
            syncUntilDate,
            currency,
          ),
        );
        continue;
      }

      newJobs.push(job);
    }

    logger.info(`Exit enqueue jobs ${reqId}`);
    return newJobs;
  }

  async start() {
    this.startProcessing();
  }

  private async startProcessing() {
    let previousWallet: string | undefined;

    let job: Job | undefined;

    while (true) {
      try {
        const jobs = await firstValueFrom(
          this.jobsService.pendingJobs$.pipe(filter((jobs) => jobs.length > 0)),
        );

        const jobInfo = determineNextJob(jobs, previousWallet);
        if (!jobInfo) continue;

        job = await this.jobsService.fetchJob(jobInfo.id);

        previousWallet = job.wallet;
        const jobProcessor: JobProcessor =
          this.DIContainer.resolve("jobProcessor");
        job = await jobProcessor.process(job);

        await this.jobsService.setToPostProcessing(job);
        this.postProcessingStream.next({ id: job.id, wallet: job.wallet });
        const allPendingJobs = await this.jobsService.fetchAllPendingJobs();
        logger.info("Remaining pending jobs:" + allPendingJobs.length);
      } catch (error) {
        this.handleError(error, job);
        logger.error(error);
      }
    }
  }

  private async schedulePostProcessing() {
    // Try to start jobs while respecting concurrency + per-user rule
    for (let i = 0; i < this.postProcessingQueue.length; i++) {
      const job = this.postProcessingQueue[i];

      if (this.postProcessingWallets.has(job.wallet)) {
        continue;
      }

      if (this.postProcessingWallets.size >= PARALLEL_POST_PROCESSING_JOBS) {
        break;
      }

      this.postProcessingQueue.splice(i, 1);
      i--;

      this.postProcessingWallets.add(job.wallet);

      logger.info("Postprocessing job: " + job.id);
      await this.doPostProcessing(job.id);
      logger.info("Finished postprocessing" + job.id);
      this.postProcessingWallets.delete(job.wallet);
      this.schedulePostProcessing();
    }
  }

  private async doPostProcessing(jobId: string) {
    let job: Job | undefined;
    try {
      job = await this.jobsService.fetchJob(jobId);

      if (job.status !== "post_processing") {
        return;
      }

      if (this.isPolkadotApiSupported(job.blockchain)) {
        const jobPostProcessor: JobPostProcessor =
          this.DIContainer.resolve("jobPostProcessor");
        job = await jobPostProcessor.postProcess(job);
      } else {
        job.data.values = job.data.values.filter(
          (v: TaxableEvent) =>
            v.label === "Staking reward" || v.label === "Staking slashed",
        );
        job.data.deviations = undefined;
      }
      job.status = "done";
      await this.jobsService.setDone(job);
    } catch (error) {
      this.handleError(error, job);
      logger.error(error);
    }
  }

  private async handleError(error: any, job: Job): Promise<void> {
    try {
      await this.jobsService.setError(
        {
          code: error?.statusCode ?? 500,
          msg:
            error?.message ??
            `Unhandled error processing job: ${JSON.stringify(job)}`,
        },
        job.id,
      );
    } catch (nestedError) {
      logger.error(nestedError, "JobConsumer: failed to set error state: ");
      logger.error("Job details: ", job);
    }
  }
}
