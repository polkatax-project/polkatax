import { asClass, AwilixContainer, Lifetime } from "awilix";
import { StakingRewardsService } from "./substrate/services/staking-rewards.service";
import { SubscanApi } from "./substrate/api/subscan.api";
import { SubscanService } from "./substrate/api/subscan.service";
import { EvmTxService } from "./evm/service/evm-tx.service";
import { EvmSwapsAndPaymentsService } from "./evm/service/evm-swaps-and-payments.service";
import { StakingRewardsViaEventsService } from "./substrate/services/staking-rewards-via-events.service";
import { XcmService } from "./substrate/services/xcm.service";
import { TransactionsService } from "./substrate/services/transactions.service";

export const registerServices = (container: AwilixContainer) => {
  container.register({
    subscanService: asClass(SubscanService, {
      lifetime: Lifetime.SINGLETON,
    }),
    subscanApi: asClass(SubscanApi, {
      lifetime: Lifetime.SINGLETON,
    }),
    transactionsService: asClass(TransactionsService),
    stakingRewardsService: asClass(StakingRewardsService),
    evmSwapsAndPaymentsService: asClass(EvmSwapsAndPaymentsService),
    evmTxService: asClass(EvmTxService),
    stakingRewardsViaEventsService: asClass(StakingRewardsViaEventsService),
    xcmService: asClass(XcmService),
  });
};
