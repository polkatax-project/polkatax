import { DEVIATION_LIMITS } from "../../../src/server/data-correction/const/deviation-limits";
import { PortfolioChangeValidationService } from "../../../src/server/data-correction/portfolio-change-validation.service";
import { createDIContainer } from "../../../src/server/di-container";
import { fetchPortfolioMovements } from "./fetch-portfolio-movements";
import { PortfolioMovementCorrectionService } from "../../../src/server/data-correction/portfolio-movement-correction.service";
import * as fs from "fs";

export const verifyPortfolioChanges = async (
  address: string,
  chainInfo: { domain: string; token: string },
  minDate: number,
  maxDate: number,
) => {
  const container = createDIContainer();
  const { portfolioMovements, minBlock, maxBlock } =
    await fetchPortfolioMovements(address, chainInfo, minDate, maxDate);
  if (portfolioMovements.length === 0) {
    return;
  }
  const portfolioChangeValidationService: PortfolioChangeValidationService =
    container.resolve("portfolioChangeValidationService");
  const deviations =
    await portfolioChangeValidationService.calculateDeviationFromExpectation(
      chainInfo,
      address,
      portfolioMovements,
      DEVIATION_LIMITS,
      minBlock,
      maxBlock,
    );
  await portfolioChangeValidationService.disconnectApi();
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
      "./integration-tests/out-temp/portfolio-movements.json",
      JSON.stringify(portfolioMovements, null, 2),
    );
    const portfolioMovementCorrectionService: PortfolioMovementCorrectionService =
      container.resolve("portfolioMovementCorrectionService");
    await portfolioMovementCorrectionService.fixErrorsAndMissingData(
      chainInfo,
      address,
      portfolioMovements,
      minDate,
      maxDate,
    );
    fs.writeFileSync(
      "./integration-tests/out-temp/portfolio-movements-fixed.json",
      JSON.stringify(portfolioMovements, null, 2),
    );
    throw new Error(
      `Deviation from expectation too large for ${address} and ${chainInfo.domain}`,
    );
  }
};
