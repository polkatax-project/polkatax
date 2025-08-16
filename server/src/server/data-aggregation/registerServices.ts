import { asClass, AwilixContainer } from "awilix";
import { StakingRewardsWithFiatService } from "./services/staking-rewards-with-fiat.service";
import { PortfolioMovementsService } from "./services/portfolio-movements.service";
import { TokenPriceConversionService } from "./services/token-price-conversion.service";
import { CryptoCurrencyPricesService } from "./services/crypto-currency-prices.service";
import { FiatExchangeRateService } from "./services/fiat-exchange-rate.service";
import { ChainAdjustments } from "./helper/chain-adjustments";
import { TransferMerger } from "./helper/transfer-merger";
import { AddFiatValuesToPortfolioMovementsService } from "./services/add-fiat-values-to-portfolio-movements.service";
import { ChainDataAccumulationService } from "./services/chain-data-accumulation.service";
import { SpecialEventsToTransfersService } from "./services/special-event-processing/special-events-to-transfers.service";
import { XcmTokenResolutionService } from "./services/xcm-token-resolution.service";
import { TokenFromMultiLocationService } from "./services/special-event-processing/token-from-multi-location.service";

export const registerServices = (container: AwilixContainer) => {
  container.register({
    addFiatValuesToPortfolioMovementsService: asClass(
      AddFiatValuesToPortfolioMovementsService,
    ),
    specialEventsToTransfersService: asClass(SpecialEventsToTransfersService),
    stakingRewardsWithFiatService: asClass(StakingRewardsWithFiatService),
    cryptoCurrencyPricesService: asClass(CryptoCurrencyPricesService),
    fiatExchangeRateService: asClass(FiatExchangeRateService),
    tokenPriceConversionService: asClass(TokenPriceConversionService),
    portfolioMovementsService: asClass(PortfolioMovementsService),
    chainAdjustments: asClass(ChainAdjustments),
    chainDataAccumulationService: asClass(ChainDataAccumulationService),
    transferMerger: asClass(TransferMerger),
    xcmTokenResolutionService: asClass(XcmTokenResolutionService),
    tokenFromMultiLocationService: asClass(TokenFromMultiLocationService),
  });
};
