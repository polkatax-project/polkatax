import { asClass, AwilixContainer, Lifetime } from "awilix";
import { PortfolioDifferenceService } from "../data-correction/portfolio-difference.service";
import { PortfolioMovementCorrectionService } from "../data-correction/portfolio-movement-correction.service";
import { PortfolioChangeValidationService } from "./portfolio-change-validation.service";
import { FetchCurrentPrices } from "./fetch-crypto-prices";
import { DeviationZoomer } from "./deviation-zoomer";

export const registerServices = (container: AwilixContainer) => {
  container.register({
    deviationZoomer: asClass(DeviationZoomer),
    portfolioDifferenceSerivce: asClass(PortfolioDifferenceService),
    portfolioChangeValidationService: asClass(PortfolioChangeValidationService),
    portfolioMovementCorrectionService: asClass(
      PortfolioMovementCorrectionService,
    ),
    fetchCurrentPrices: asClass(FetchCurrentPrices, {
      lifetime: Lifetime.SINGLETON,
    }),
  });
};
