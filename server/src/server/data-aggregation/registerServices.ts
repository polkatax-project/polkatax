import { asClass, AwilixContainer } from "awilix";
import { StakingRewardsWithFiatService } from "./services/staking-rewards-with-fiat.service";
import { PaymentsService } from "./services/substrate-payments.service";
import { TokenPriceConversionService } from "./services/token-price-conversion.service";
import { CryptoCurrencyPricesService } from "./services/crypto-currency-prices.service";
import { FiatExchangeRateService } from "./services/fiat-exchange-rate.service";
import { ChainAdjustments } from "./helper/chain-adjustments";
import { TransferMerger } from "./helper/transfer-merger";
import { CoingeckoIdLookupService } from "./services/coingecko-id-lookup.service";
import { EventsToPaymentsService } from "./services/events-to-payments.service";
import { AddFiatValuesToPaymentsService } from "./services/add-fiat-values-to-payments.service";
import { ChainDataAccumulationService } from "./services/chain-data-accumulation.service";

export const registerServices = (container: AwilixContainer) => {
  container.register({
    addFiatValuesToPaymentsService: asClass(AddFiatValuesToPaymentsService),
    eventsToPaymentsService: asClass(EventsToPaymentsService),
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
