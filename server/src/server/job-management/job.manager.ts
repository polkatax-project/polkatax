import { JobsService } from "./jobs.service";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { Job, JobId } from "../../model/job";
import { filter, firstValueFrom, mergeMap, Subject } from "rxjs";
import { determineNextJob } from "./determine-next-job";
import { AwilixContainer } from "awilix";
import { isEvmAddress } from "../data-aggregation/helper/is-evm-address";
import {
  getBeginningLastYear,
  getEndOfLastYear,
} from "./get-beginning-last-year";
import { logger } from "../logger/logger";
import { JobProcessor } from "./job.processor";
import { JobPostProcessor } from "./job.post-processor";

const PARALLEL_POST_PROCESSING_JOBS = 2;

export class JobManager {
  private postProcessingQueue = new Subject<JobId>();

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
    blockchains: string[] = [],
  ): Promise<Job[]> {
    logger.info(`Enter enqueue jobs ${reqId}, ${wallet}, ${currency}`);

    const syncFromDate = getBeginningLastYear();
    const chains = blockchains.length ? blockchains : this.getChains(wallet);
    const jobs = await this.jobsService.fetchJobs(wallet);
    const matchingJobs = jobs.filter(
      (j) =>
        chains.includes(j.blockchain) &&
        j.currency === currency &&
        j.syncFromDate === syncFromDate,
    );

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

        job = await this.jobsService.fetchJob(
          jobInfo.wallet,
          jobInfo.blockchain,
          jobInfo.currency,
        );

        previousWallet = job.wallet;
        const jobProcessor: JobProcessor =
          this.DIContainer.resolve("jobProcessor");
        job = await jobProcessor.process(job);
        job.status = "post_processing";
        await this.jobsService.setToPostProcessing(job);
        this.enqueueForPostProcessing(job);
        const allPendingJobs = await this.jobsService.fetchAllPendingJobs();
        logger.info("Remaining pending jobs:" + allPendingJobs.length);
      } catch (error) {
        this.handleError(error, job);
        logger.error(error);
      }
    }
  }

  private async enqueueForPostProcessing(jobId: JobId) {
    this.postProcessingQueue.next({
      wallet: jobId.wallet,
      blockchain: jobId.blockchain,
      currency: jobId.currency,
    });
  }

  private async startPostProcessing() {
    this.postProcessingQueue
      .pipe(
        mergeMap(async (job) => {
          logger.info(job, "Postprocessing job");
          await this.doPostProcessing(job);
          logger.info(job, "Finished postprocessing");
        }, PARALLEL_POST_PROCESSING_JOBS),
      )
      .subscribe();
  }

  private async doPostProcessing(jobId: JobId) {
    let job: Job | undefined;
    try {
      job = await this.jobsService.fetchJob(
        jobId.wallet,
        jobId.blockchain,
        jobId.currency,
      );

      if (job.status !== "post_processing") {
        return;
      }

      const jobPostProcessor: JobPostProcessor =
        this.DIContainer.resolve("jobPostProcessor");
      job = await jobPostProcessor.postProcess(job);
      job.status = "done";
      await this.jobsService.setDone(job, getEndOfLastYear());
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
        job,
      );
    } catch (nestedError) {
      logger.error(nestedError, "JobConsumer: failed to set error state: ");
      logger.error("Job details: ", job);
    }
  }
}
