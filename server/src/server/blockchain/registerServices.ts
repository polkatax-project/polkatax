import { asClass, AwilixContainer, Lifetime } from "awilix";
import { StakingRewardsService } from "./substrate/services/staking-rewards.service";
import { SubscanApi } from "./substrate/api/subscan.api";
import { SubscanService } from "./substrate/api/subscan.service";
import { XcmService } from "./substrate/services/xcm.service";
import { EthTokenInfoService } from "./evm/service/eth.token-info.service";
import { PolkadotApi } from "./substrate/api/polkadot-api";
import { BlockTimeService } from "./substrate/services/block-time.service";

export const registerServices = (container: AwilixContainer) => {
  container.register({
    subscanService: asClass(SubscanService, {
      lifetime: Lifetime.SINGLETON,
    }),
    subscanApi: asClass(SubscanApi, {
      lifetime: Lifetime.SINGLETON,
    }),
    stakingRewardsService: asClass(StakingRewardsService),
    blockTimeService: asClass(BlockTimeService),
    xcmService: asClass(XcmService),
    ethTokenInfoService: asClass(EthTokenInfoService),
    polkadotApi: asClass(PolkadotApi),
  });
};
