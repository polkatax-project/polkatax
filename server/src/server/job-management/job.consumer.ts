import { Job } from "../../model/job";
import { StakingRewardsWithFiatService } from "../data-aggregation/services/staking-rewards-with-fiat.service";
import { logger } from "../logger/logger";
import { JobsService } from "./jobs.service";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { StakingRewardsResponse } from "../data-aggregation/model/staking-rewards.response";

export class JobConsumer {
  constructor(
    private jobsService: JobsService,
    private stakingRewardsWithFiatService: StakingRewardsWithFiatService,
  ) {}

  async process(job: Job): Promise<void> {
    logger.info("JobConsumer: processing job", {
      ...job,
      data: undefined, // avoid logging large/stale data
    });

    const chain = subscanChains.chains.find(
      (c) => c.domain.toLowerCase() === job.blockchain.toLowerCase(),
    );

    if (!chain) {
      return this.jobsService.setError(
        { code: 400, msg: `Chain ${job.blockchain} not found` },
        job,
      );
    }

    const claimed = await this.jobsService.setInProgress(job);
    if (!claimed) {
      logger.info("Job already claimed by another process");
      return;
    }

    try {
      const result =
        await this.stakingRewardsWithFiatService.fetchStakingRewardsViaSubscan({
          chain,
          address: job.wallet,
          currency: job.currency,
          minDate: job.syncFromDate,
        });

      // Merge previously synced values (if any)
      if (job.data) {
        const previous = (job.data as StakingRewardsResponse).values.filter(
          (v) => v.timestamp < job.syncFromDate,
        );
        result.values.push(...previous);
      }

      await this.jobsService.setDone(result, job);
      logger.info("JobConsumer: finished processing job", {
        ...job,
        data: undefined,
      });
    } catch (err) {
      logger.error("JobConsumer: error during processing");
      logger.error(err);
      await this.handleError(err, job);
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
      logger.error("JobConsumer: failed to set error state", nestedError);
      logger.error("Job details: ", job);
    }
  }
}
