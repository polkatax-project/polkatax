import { JobsService } from "./jobs.service";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { Job } from "../../model/job";
import { filter, firstValueFrom } from "rxjs";
import { determineNextJob } from "./determine-next-job";
import { AwilixContainer } from "awilix";
import { isEvmAddress } from "../data-aggregation/helper/is-evm-address";
import { getBeginningLastYear } from "./get-beginning-last-year";
import { logger } from "../logger/logger";
import { JobConsumer } from "./job.consumer";
import { JobRepository } from "./job.repository";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export class JobManager {
  constructor(
    private jobsService: JobsService,
    private DIContainer: AwilixContainer
  ) {}

  getStakingChains(wallet: string): string[] {
    const isEvm = isEvmAddress(wallet);
    return subscanChains.chains
      .filter((c) => c.stakingPallets.length > 0 && !c.pseudoStaking)
      .filter((c) => !isEvm || c.evmPallet || c.evmAddressSupport)
      .map((c) => c.domain);
  }

  getChains(wallet: string): string[] {
    const isEvm = isEvmAddress(wallet);
    return subscanChains.chains
      .filter((c) => !isEvm || c.evmPallet || c.evmAddressSupport)
      .map((c) => c.domain);
  }

  isOutdated(job: Job): boolean {
    return Date.now() - job.lastModified > ONE_DAY_MS;
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
      (j) => chains.includes(j.blockchain) && j.currency === currency,
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

      if (job.status === "done" && this.isOutdated(job)) {
        await this.jobsService.delete(job);
        newJobs.push(
          await this.jobsService.addJob(
            reqId,
            wallet,
            chain,
            job.syncedUntil ? job.syncedUntil - ONE_DAY_MS : syncFromDate,
            currency,
            job.data,
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
    let previousWallet: string | undefined;

    while (true) {
      try {
        const jobs = await firstValueFrom(
          this.jobsService.pendingJobs$.pipe(filter((jobs) => jobs.length > 0)),
        );

        const jobInfo = determineNextJob(jobs, previousWallet);
        if (!jobInfo) continue;

        const job = await this.jobsService.fetchJob(
          jobInfo.wallet,
          jobInfo.blockchain,
          jobInfo.currency,
        );

        previousWallet = job.wallet;
        const jobConsumer: JobConsumer =
          this.DIContainer.resolve("jobConsumer");
        await jobConsumer.process(job);
        const allPendingJobs = await this.jobsService.fetchAllPendingJobs();
        logger.info("Remaining pending jobs:" + allPendingJobs.length);
      } catch (error) {
        logger.error(error);
      }
    }
  }
}
