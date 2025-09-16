import { Job } from "../../model/job";
import { logger } from "../logger/logger";
import { JobsService } from "./jobs.service";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { PortfolioMovementsService } from "../data-aggregation/services/portfolio-movements.service";

export class JobProcessor {
  constructor(
    private jobsService: JobsService,
    private portfolioMovementsService: PortfolioMovementsService,
  ) {}

  async process(job: Job): Promise<Job> {
    logger.info(
      { ...job, error: job.error ? job.error : undefined, data: undefined },
      "JobProcessor: processing job",
    );

    const chain = subscanChains.chains.find(
      (c) => c.domain.toLowerCase() === job.blockchain.toLowerCase(),
    );

    if (!chain) {
      await this.jobsService.setError(
        { code: 400, msg: `Chain ${job.blockchain} not found` },
        job.id,
      );
      return job;
    }

    const claimed = await this.jobsService.setInProgress(job.id);
    if (!claimed) {
      logger.info("Job already claimed by another process");
      return;
    }

    const result = await this.portfolioMovementsService.fetchPortfolioMovements(
      {
        chain,
        address: job.wallet,
        currency: job.currency,
        minDate: job.syncFromDate,
        maxDate: job.syncUntilDate,
      },
    );
    job.data = {
      values: result.portfolioMovements,
    };

    logger.info(
      {
        ...job,
        error: job.error ? job.error : undefined,
        data: undefined,
        status: "post_processing",
      },
      "JobProcessor: finished processing job",
    );
    return job;
  }
}
