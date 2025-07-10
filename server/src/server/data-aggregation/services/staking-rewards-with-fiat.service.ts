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
import * as subscanChains from "../../../../res/gen/subscan-chains.json";

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

  async fetchStakingRewardsViaPlatformApi(
    address: string,
    currency: string,
  ): Promise<(StakingRewardsResponse & { currency: string; chain: string })[]> {
    const aggregatedRewards: {
      chain: string;
      values: PricedStakingReward[];
    }[] = await this.dataPlatformService.fetchAggregatedStakingRewards(address);
    const domains = aggregatedRewards.map((a) => a.chain);
    const coingeckoIds = domains
      .map((d) => findCoingeckoIdForNativeToken(d))
      .filter((id) => !!id);

    const quotes = await (coingeckoIds.length > 0
      ? this.tokenPriceConversionService.fetchQuotesForTokens(
          coingeckoIds,
          currency,
        )
      : Promise.resolve({}));

    return aggregatedRewards.map((rewards) => {
      const chainInfo = subscanChains.chains.find(
        (c) => c.domain === rewards.chain,
      );
      return {
        values: addFiatValuesToStakingRewards(
          rewards.values,
          quotes[findCoingeckoIdForNativeToken(rewards.chain)],
        ),
        token: chainInfo.token,
        currency,
        chain: rewards.chain,
      };
    });
  }

  async fetchStakingRewardsViaSubscan(
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
      this.fetchFromSubscan(stakingRewardsRequest),
    ]);

    return {
      values: addFiatValuesToStakingRewards(rewards, quotes[coingeckoId]),
      token: chain.token,
    };
  }
}
