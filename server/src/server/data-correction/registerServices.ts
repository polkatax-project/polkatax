import { asClass, AwilixContainer } from "awilix";
import { PortfolioDifferenceService } from "../data-correction/portfolio-difference.service";
import { PortfolioMovementCorrectionService } from "../data-correction/portfolio-movement-correction.service";
import { PortfolioChangeValidationService } from "./portfolio-change-validation.service";

export const registerServices = (container: AwilixContainer) => {
  container.register({
    portfolioDifferenceSerivce: asClass(PortfolioDifferenceService),
    portfolioChangeValidationService: asClass(PortfolioChangeValidationService),
    portfolioMovementCorrectionService: asClass(
      PortfolioMovementCorrectionService,
    ),
  });
};
