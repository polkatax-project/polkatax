import { Job } from "../../model/job";
import { logger } from "../logger/logger";
import { JobsService } from "./jobs.service";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { PortfolioMovementsService } from "../data-aggregation/services/portfolio-movements.service";

export class JobConsumer {
  constructor(
    private jobsService: JobsService,
    private portfolioMovementsService: PortfolioMovementsService,
  ) {}

  async process(job: Job): Promise<void> {
    logger.info(
      { ...job, error: job.error ? job.error : undefined, data: undefined },
      "JobConsumer: processing job",
    );

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
        await this.portfolioMovementsService.fetchPortfolioMovements({
          chain,
          address: job.wallet,
          currency: job.currency,
          minDate: job.syncFromDate,
        });
      const portfolioMovements = result.portfolioMovements;

      // Merge previously synced values (if any)
      if (job.data) {
        const previous = job.data.values.filter(
          (v) => v.timestamp < job.syncFromDate,
        );
        portfolioMovements.push(...previous);
      }

      const eightDaysMs = 6 * 24 * 60 * 60 * 1000;
      job.syncedUntil = Date.now() - eightDaysMs; // "guaranteed" to be synced until 6 days ago, because backend data is not updated daily!
      await this.jobsService.setDone(
        { values: portfolioMovements },
        job,
        job.syncedUntil,
      );
      logger.info(
        {
          ...job,
          error: job.error ? job.error : undefined,
          data: undefined,
          status: "done",
        },
        "JobConsumer: finished processing job",
      );
    } catch (err) {
      logger.error(err, "JobConsumer: error during processing");
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
      logger.error(nestedError, "JobConsumer: failed to set error state: ");
      logger.error("Job details: ", job);
    }
  }
}
