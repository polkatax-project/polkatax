import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { StakingRewardsService } from "../../blockchain/substrate/services/staking-rewards.service";
import { StakingRewardsRequest } from "../model/staking-rewards.request";
import { TokenPriceConversionService } from "./token-price-conversion.service";
import { StakingRewardsResponse } from "../model/staking-rewards.response";
import { addFiatValuesToStakingRewards } from "../helper/add-fiat-values-to-staking-rewards";
import { findCoingeckoIdForNativeToken } from "../helper/find-coingecko-id-for-native-token";
import { isEvmAddress } from "../helper/is-evm-address";
import { DataPlatformService } from "../../data-platform-api/data-platform.service";
import { PricedStakingReward } from "../model/priced-staking-reward";

export class StakingRewardsWithFiatService {
  constructor(
    private stakingRewardsService: StakingRewardsService,
    private tokenPriceConversionService: TokenPriceConversionService,
    private subscanService: SubscanService,
    private dataPlatformService: DataPlatformService,
  ) {}

  private async fetchFromSubscan(
    stakingRewardsRequest: StakingRewardsRequest,
  ): Promise<PricedStakingReward[]> {
    let { chain, address, startDate } = stakingRewardsRequest;
    if (isEvmAddress(address)) {
      address =
        (await this.subscanService.mapToSubstrateAccount(
          chain.domain,
          address,
        )) || address;
    }
    return this.stakingRewardsService.fetchStakingRewards(
      chain.domain,
      address,
      startDate,
    );
  }

  private async fetchRawStakingRewards(
    stakingRewardsRequest: StakingRewardsRequest,
  ): Promise<PricedStakingReward[]> {
    let { chain, address } = stakingRewardsRequest;
    switch (chain.domain) {
      case "polkadot":
      case "kusama":
      case "hydration":
      case "enjin":
        if (process.env["USE_AGGREGATED_DATA"]) {
          const result =
            await this.dataPlatformService.fetchAggregatedStakingRewards(
              chain.domain,
              address,
            );
          return result;
        }
      default:
        return this.fetchFromSubscan(stakingRewardsRequest);
    }
  }

  async fetchStakingRewards(
    stakingRewardsRequest: StakingRewardsRequest,
  ): Promise<StakingRewardsResponse> {
    let { chain, currency } = stakingRewardsRequest;

    const coingeckoId = findCoingeckoIdForNativeToken(chain.domain);

    const [quotes, rewards] = await Promise.all([
      coingeckoId
        ? this.tokenPriceConversionService.fetchQuotesForTokens(
            [coingeckoId],
            currency,
          )
        : Promise.resolve({}),
      this.fetchRawStakingRewards(stakingRewardsRequest),
    ]);

    return {
      values: addFiatValuesToStakingRewards(rewards, quotes[coingeckoId]),
      token: chain.token,
    };
  }
}
