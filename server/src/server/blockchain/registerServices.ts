import { asClass, AwilixContainer, Lifetime } from "awilix";
import { StakingRewardsService } from "./substrate/services/staking-rewards.service";
import { SubscanApi } from "./substrate/api/subscan.api";
import { SubscanService } from "./substrate/api/subscan.service";
import { StakingRewardsViaEventsService } from "./substrate/services/staking-rewards-via-events.service";
import { XcmService } from "./substrate/services/xcm.service";
import { TransactionsService } from "./substrate/services/transactions.service";
import { EthTokenInfoService } from "./evm/service/eth.token-info.service";
import { XcmTokenResolver } from "./substrate/services/xcm-token-resolver";

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
    stakingRewardsViaEventsService: asClass(StakingRewardsViaEventsService),
    xcmService: asClass(XcmService),
    xcmTokenResolver: asClass(XcmTokenResolver),
    ethTokenInfoService: asClass(EthTokenInfoService),
  });
};
