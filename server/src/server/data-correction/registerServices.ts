import { asClass, AwilixContainer, Lifetime } from "awilix";
import { PortfolioDifferenceService } from "../data-correction/portfolio-difference.service";
import { PortfolioMovementCorrectionService } from "../data-correction/portfolio-movement-correction.service";
import { PortfolioChangeValidationService } from "./portfolio-change-validation.service";
import { FetchCurrentPrices } from "./fetch-crypto-prices";
import { BlockTimeService } from "../blockchain/substrate/services/block-time.service";

export const registerServices = (container: AwilixContainer) => {
  container.register({
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
