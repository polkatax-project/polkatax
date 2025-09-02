import { JobsService } from "./jobs.service";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { Job } from "../../model/job";
import { filter, firstValueFrom, mergeMap, Subject } from "rxjs";
import { determineNextJob } from "./determine-next-job";
import { AwilixContainer } from "awilix";
import { isEvmAddress } from "../data-aggregation/helper/is-evm-address";
import { logger } from "../logger/logger";
import { JobProcessor } from "./job.processor";
import { JobPostProcessor } from "./job.post-processor";
import { createJobId } from "./helper/create-job-id";

const PARALLEL_POST_PROCESSING_JOBS = 2;

export class JobManager {
  private postProcessingQueue = new Subject<string>();

  constructor(
    private jobsService: JobsService,
    private DIContainer: AwilixContainer,
  ) {}

  getChains(wallet: string): string[] {
    const isEvm = isEvmAddress(wallet);
    return subscanChains.chains
      .filter((c) => !c.excluded)
      .filter((c) => !isEvm || c.evmPallet || c.evmAddressSupport)
      .map((c) => c.domain);
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
    this.startPostProcessing();
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
        this.enqueueForPostProcessing(job.id);
        const allPendingJobs = await this.jobsService.fetchAllPendingJobs();
        logger.info("Remaining pending jobs:" + allPendingJobs.length);
      } catch (error) {
        this.handleError(error, job);
        logger.error(error);
      }
    }
  }

  private async enqueueForPostProcessing(jobId: string) {
    this.postProcessingQueue.next(jobId);
  }

  private async startPostProcessing() {
    this.postProcessingQueue
      .pipe(
        mergeMap(async (jobId) => {
          logger.info("Postprocessing job: " + jobId);
          await this.doPostProcessing(jobId);
          logger.info("Finished postprocessing" + jobId);
        }, PARALLEL_POST_PROCESSING_JOBS),
      )
      .subscribe();
  }

  private async doPostProcessing(jobId: string) {
    let job: Job | undefined;
    try {
      job = await this.jobsService.fetchJob(jobId);

      if (job.status !== "post_processing") {
        return;
      }

      const jobPostProcessor: JobPostProcessor =
        this.DIContainer.resolve("jobPostProcessor");
      job = await jobPostProcessor.postProcess(job);
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
