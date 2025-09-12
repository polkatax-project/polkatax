import { asClass, AwilixContainer } from "awilix";
import { CryptoCurrencyPricesService } from "./services/crypto-currency-prices.service";
import { FiatExchangeRateService } from "./services/fiat-exchange-rate.service";
import { AddFiatValuesToTaxableEventsService } from "./services/add-fiat-values-to-taxable-events.service";
import { SpecialEventsToTransfersService } from "./services/special-event-processing/special-events-to-transfers.service";
import { StakingRewardsAggregatorService } from "./services/staking-rewards-aggregator.service";
import { PortfolioMovementsService } from "./services/portfolio-movements.service";
import { BalanceChangesService } from "./services/balance-changes.service";
import { ReconciliationService } from "./services/reconciliation.service";

export const registerServices = (container: AwilixContainer) => {
  container.register({
    addFiatValuesToTaxableEventsService: asClass(
      AddFiatValuesToTaxableEventsService,
    ),
    balanceChangesService: asClass(BalanceChangesService),
    reconciliationService: asClass(ReconciliationService),
    specialEventsToTransfersService: asClass(SpecialEventsToTransfersService),
    stakingRewardsAggregatorService: asClass(StakingRewardsAggregatorService),
    cryptoCurrencyPricesService: asClass(CryptoCurrencyPricesService),
    fiatExchangeRateService: asClass(FiatExchangeRateService),
    portfolioMovementsService: asClass(PortfolioMovementsService),
  });
};
