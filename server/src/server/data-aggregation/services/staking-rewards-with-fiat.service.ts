import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { StakingRewardsService } from "../../blockchain/substrate/services/staking-rewards.service";
import { StakingRewardsRequest } from "../model/staking-rewards.request";
import { TokenPriceConversionService } from "./token-price-conversion.service";
import { StakingRewardsResponse } from "../model/staking-rewards.response";
import { addFiatValuesToStakingRewards } from "../helper/add-fiat-values-to-staking-rewards";
import { findCoingeckoIdForNativeToken } from "../helper/find-coingecko-id-for-native-token";

export class StakingRewardsWithFiatService {
  constructor(
    private stakingRewardsService: StakingRewardsService,
    private tokenPriceConversionService: TokenPriceConversionService,
  ) {}

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
      this.stakingRewardsService.fetchStakingRewards({
        ...stakingRewardsRequest,
        chainName: stakingRewardsRequest.chain.domain,
      }),
    ]);

    return {
      values: addFiatValuesToStakingRewards(rewards, quotes[coingeckoId]),
      token: chain.token,
    };
  }
}
