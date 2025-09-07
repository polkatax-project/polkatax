import { Job } from "../../model/job";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { PortfolioMovementCorrectionService } from "../data-correction/portfolio-movement-correction.service";
import { simplifyAssetMovements } from "../data-aggregation/helper/simplify-asset-movements";

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

    const relevantPortfolioMovements = simplifyAssetMovements(
      job.wallet,
      job.data.values,
    );
    job.data = { values: relevantPortfolioMovements, deviations };
    return job;
  }
}
