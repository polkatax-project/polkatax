import { Job } from "../../model/job";
import { logger } from "../logger/logger";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { PortfolioMovementCorrectionService } from "../data-correction/portfolio-movement-correction.service";
import { getEndOfLastYear } from "./get-beginning-last-year";

export class JobPostProcessor {
  constructor(
    private portfolioMovementCorrectionService: PortfolioMovementCorrectionService,
  ) {}

  async postProcess(job: Job): Promise<Job> {
    const chain = subscanChains.chains.find(
      (c) => c.domain.toLowerCase() === job.blockchain.toLowerCase(),
    );

    const deviations =
      await this.portfolioMovementCorrectionService.fixErrorsAndMissingData(
        chain,
        job.wallet,
        job.data.values,
        job.syncFromDate,
        job.syncUntilDate,
      );

    const relevantPortfolioMovements = job.data.values.filter(
      (p) => p.transfers.length > 0,
    );
    job.data = { values: relevantPortfolioMovements, deviations };
    return job;
  }
}
