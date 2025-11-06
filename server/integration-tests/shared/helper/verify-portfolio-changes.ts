import { DEVIATION_LIMITS } from "../../../src/server/data-correction/const/deviation-limits";
import { createDIContainer } from "../../../src/server/di-container";
import { fetchPortfolioMovements } from "./fetch-portfolio-movements";
import { PortfolioMovementCorrectionService } from "../../../src/server/data-correction/portfolio-movement-correction.service";
import * as fs from "fs";

export const verifyPortfolioChanges = async (
  address: string,
  chainInfo: { domain: string; token: string },
  minDate: number,
  maxDate: number,
  deviationLimits = DEVIATION_LIMITS,
) => {
  const container = createDIContainer();
  const { portfolioMovements, blockMax, blockMin } =
    await fetchPortfolioMovements(address, chainInfo, minDate, maxDate);
  if (portfolioMovements.length === 0) {
    return;
  }

  const portfolioMovementCorrectionService: PortfolioMovementCorrectionService =
    container.resolve("portfolioMovementCorrectionService");
  const deviations =
    await portfolioMovementCorrectionService.calculateDeviationWithRetry(
      chainInfo,
      address,
      portfolioMovements,
      deviationLimits,
      blockMin,
      blockMax,
    );
  deviations.forEach((d) => {
    if (d.absoluteDeviationTooLarge) {
      console.log(
        `Deviation from expectation too large for ${address} and ${chainInfo.domain}:`,
      );
      console.log(JSON.stringify(d, null, 2));
    }
  });
  if (deviations.some((d) => d.absoluteDeviationTooLarge)) {
    fs.writeFileSync(
      "./integration-tests/out-temp/deviations.json",
      JSON.stringify(deviations, null, 2),
    );
    fs.writeFileSync(
      `./integration-tests/out-temp/${address}-${chainInfo.domain}-portfolio-movements.json`,
      JSON.stringify(portfolioMovements, null, 2),
    );

    await portfolioMovementCorrectionService.fixErrorsAndMissingData(
      chainInfo,
      address,
      portfolioMovements,
      minDate,
      maxDate,
      deviationLimits,
    );
    fs.writeFileSync(
      `./integration-tests/out-temp/${address}-${chainInfo.domain}-portfolio-movements-fixed.json`,
      JSON.stringify(portfolioMovements, null, 2),
    );
    throw new Error(
      `Deviation from expectation too large for ${address} and ${chainInfo.domain}`,
    );
  }
  await portfolioMovementCorrectionService.disconnect();
};
