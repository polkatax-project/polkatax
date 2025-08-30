import { asClass, AwilixContainer } from "awilix";
import { CryptoCurrencyPricesService } from "./services/crypto-currency-prices.service";
import { FiatExchangeRateService } from "./services/fiat-exchange-rate.service";
import { ChainAdjustments } from "./helper/chain-adjustments";
import { TransferMerger } from "./helper/transfer-merger";
import { AddFiatValuesToTaxableEventsService } from "./services/add-fiat-values-to-taxable-events.service";
import { ChainDataAccumulationService } from "./services/chain-data-accumulation.service";
import { SpecialEventsToTransfersService } from "./services/special-event-processing/special-events-to-transfers.service";
import { XcmTokenResolutionService } from "./services/xcm-token-resolution.service";
import { TokenFromMultiLocationService } from "./services/special-event-processing/token-from-multi-location.service";
import { StakingRewardsAggregatorService } from "./services/staking-rewards-aggregator.service";
import { PortfolioMovementsService } from "./services/portfolio-movements.service";

export const registerServices = (container: AwilixContainer) => {
  container.register({
    addFiatValuesToTaxableEventsService: asClass(
      AddFiatValuesToTaxableEventsService,
    ),
    specialEventsToTransfersService: asClass(SpecialEventsToTransfersService),
    stakingRewardsAggregatorService: asClass(StakingRewardsAggregatorService),
    cryptoCurrencyPricesService: asClass(CryptoCurrencyPricesService),
    fiatExchangeRateService: asClass(FiatExchangeRateService),
    portfolioMovementsService: asClass(PortfolioMovementsService),
    chainAdjustments: asClass(ChainAdjustments),
    chainDataAccumulationService: asClass(ChainDataAccumulationService),
    transferMerger: asClass(TransferMerger),
    xcmTokenResolutionService: asClass(XcmTokenResolutionService),
    tokenFromMultiLocationService: asClass(TokenFromMultiLocationService),
  });
};
