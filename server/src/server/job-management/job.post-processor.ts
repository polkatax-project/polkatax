import { Job } from "../../model/job";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { PortfolioMovementCorrectionService } from "../data-correction/portfolio-movement-correction.service";
import { AddFiatValuesToTaxableEventsService } from "../data-aggregation/services/add-fiat-values-to-taxable-events.service";

export class JobPostProcessor {
  constructor(
    private portfolioMovementCorrectionService: PortfolioMovementCorrectionService,
    private addFiatValuesToTaxableEventsService: AddFiatValuesToTaxableEventsService,
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

    job.data = { values: job.data.values, deviations };

    await this.addFiatValuesToTaxableEventsService.addFiatValues(
      {
        address: job.wallet,
        chain: job.blockchain,
        currency: job.currency,
      },
      job.data.values,
    );

    return job;
  }
}
