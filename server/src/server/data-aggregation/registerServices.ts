import { asClass, AwilixContainer } from "awilix";
import { StakingRewardsWithFiatService } from "./services/staking-rewards-with-fiat.service";
import { PaymentsService } from "./services/substrate-payments.service";
import { TokenPriceConversionService } from "./services/token-price-conversion.service";
import { CryptoCurrencyPricesService } from "./services/crypto-currency-prices.service";
import { FiatExchangeRateService } from "./services/fiat-exchange-rate.service";
import { ChainAdjustments } from "./helper/chain-adjustments";
import { TransferMerger } from "./helper/transfer-merger";
import { CoingeckoIdLookupService } from "./services/coingecko-id-lookup.service";
import { AddFiatValuesToPaymentsService } from "./services/add-fiat-values-to-payments.service";
import { ChainDataAccumulationService } from "./services/chain-data-accumulation.service";
import { EventsService } from "./services/events.service";
import { HandleUnmatchedEventsService } from "./services/handle-unmatched-events.service";
import { SpecialEventsToTransfersService } from "./services/special-events-to-transfers.service";

export const registerServices = (container: AwilixContainer) => {
  container.register({

    eventsService: asClass(EventsService),
    addFiatValuesToPaymentsService: asClass(AddFiatValuesToPaymentsService),
    specialEventsToTransfersService: asClass(SpecialEventsToTransfersService),
    handleUnmatchedEventsService: asClass(HandleUnmatchedEventsService),
    stakingRewardsWithFiatService: asClass(StakingRewardsWithFiatService),
    cryptoCurrencyPricesService: asClass(CryptoCurrencyPricesService),
    fiatExchangeRateService: asClass(FiatExchangeRateService),
    tokenPriceConversionService: asClass(TokenPriceConversionService),
    paymentsService: asClass(PaymentsService),
    chainAdjustments: asClass(ChainAdjustments),
    chainDataAccumulationService: asClass(ChainDataAccumulationService),
    transferMerger: asClass(TransferMerger),
    coingeckoIdLookupService: asClass(CoingeckoIdLookupService),
  });
};