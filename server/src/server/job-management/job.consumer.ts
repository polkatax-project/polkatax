import { Job } from "../../model/job";
import { StakingRewardsWithFiatService } from "../data-aggregation/services/staking-rewards-with-fiat.service";
import { logger } from "../logger/logger";
import { JobsCache } from "./jobs.cache";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { StakingRewardsResponse } from "../data-aggregation/model/staking-rewards.response";

export class JobConsumer {
  constructor(
    private jobsCache: JobsCache,
    private stakingRewardsWithFiatService: StakingRewardsWithFiatService,
  ) {}

  async process(job: Job) {
    try {
      logger.info(
        "Entry: JobConsumer process: " +
          JSON.stringify({ ...job, data: undefined }),
      );
      const chain = subscanChains.chains.find(
        (p) => p.domain.toLowerCase() === job.blockchain.toLowerCase(),
      );
      if (!chain) {
        this.jobsCache.setError(
          {
            code: 400,
            msg: "Chain " + job.blockchain + " not found",
          },
          job,
        );
        return;
      }
      this.jobsCache.setInProgress(job);

      const result =
        await this.stakingRewardsWithFiatService.fetchStakingRewards({
          chain,
          address: job.wallet,
          currency: job.currency,
          minDate: job.syncFromDate,
        });
      if (job.data) {
        const previouslySyncedValues = (
          job.data as StakingRewardsResponse
        ).values.filter((v) => v.timestamp < job.syncFromDate);
        result.values = result.values.concat(previouslySyncedValues);
      }
      this.jobsCache.setDone(result, job);
      logger.info(
        "Exit: JobConsumer process: " +
          JSON.stringify({ ...job, data: undefined }),
      );
    } catch (error) {
      logger.error(error);
      logger.error("Error processing job: " + JSON.stringify(job));
      try {
        this.jobsCache.setError(
          {
            code: error?.statusCode ?? 500,
            msg:
              error.message ?? "Error processing job: " + JSON.stringify(job),
          },
          job,
        );
      } catch (error) {
        logger.error(error);
        logger.error("Setting job to state error: " + JSON.stringify(job));
      }
    }
  }
}
