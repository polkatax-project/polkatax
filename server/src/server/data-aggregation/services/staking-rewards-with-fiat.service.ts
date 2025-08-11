import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { StakingRewardsService } from "../../blockchain/substrate/services/staking-rewards.service";
import { StakingRewardsRequest } from "../model/staking-rewards.request";
import { TokenPriceConversionService } from "./token-price-conversion.service";
import {
  addFiatValuesToAggregatedStakingRewards,
  addFiatValuesToStakingRewards,
} from "../helper/add-fiat-values-to-staking-rewards";
import { findCoingeckoIdForNativeToken } from "../helper/find-coingecko-id-for-native-token";
import { isEvmAddress } from "../helper/is-evm-address";
import { DataPlatformService } from "../../data-platform-api/data-platform.service";
import { AggregatedStakingReward } from "../model/aggregated-staking-reward";
import { StakingReward } from "../../blockchain/substrate/model/staking-reward";

export class StakingRewardsWithFiatService {
  constructor(
    private stakingRewardsService: StakingRewardsService,
    private tokenPriceConversionService: TokenPriceConversionService,
    private subscanService: SubscanService,
    private dataPlatformService: DataPlatformService,
  ) {}

  private async fetchFromSubscan(
    stakingRewardsRequest: StakingRewardsRequest,
  ): Promise<StakingReward[]> {
    let { chain, address, minDate } = stakingRewardsRequest;
    if (isEvmAddress(address)) {
      address =
        (await this.subscanService.mapToSubstrateAccount(
          chain.domain,
          address,
        )) || address;
    }
    return this.stakingRewardsService.fetchStakingRewards({
      chainName: chain.domain,
      address,
      minDate,
    });
  }

  private async fetchStakingRewardsViaPlatformApi(
    stakingRewardsRequest: StakingRewardsRequest,
  ): Promise<AggregatedStakingReward[]> {
    const aggregatedRewards: AggregatedStakingReward[] =
      await this.dataPlatformService.fetchAggregatedStakingRewardsForChain(
        stakingRewardsRequest.address,
        stakingRewardsRequest.chain.domain,
      );
    const coingeckoId = findCoingeckoIdForNativeToken(
      stakingRewardsRequest.chain.domain,
    );

    const quotes = await (coingeckoId
      ? this.tokenPriceConversionService.fetchQuotesForTokens(
          [coingeckoId],
          stakingRewardsRequest.currency,
        )
      : Promise.resolve({}));

    addFiatValuesToAggregatedStakingRewards(
      aggregatedRewards,
      quotes[coingeckoId],
    );

    return aggregatedRewards;
  }

  public async fetchStakingRewardsViaSubscan(
    stakingRewardsRequest: StakingRewardsRequest,
  ): Promise<StakingReward[]> {
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

    addFiatValuesToStakingRewards(rewards, quotes[coingeckoId]);

    return rewards;
  }

  async fetchStakingRewards(
    stakingRewardsRequest: StakingRewardsRequest,
  ): Promise<{
    rawStakingRewards: StakingReward[];
    aggregatedRewards: AggregatedStakingReward[];
  }> {
    switch (stakingRewardsRequest.chain.domain) {
      case "polkadot":
      case "kusama":
      case "hydration":
      case "enjin":
        if (process.env["USE_DATA_PLATFORM_API"]) {
          return {
            rawStakingRewards: [],
            aggregatedRewards: await this.fetchStakingRewardsViaPlatformApi(
              stakingRewardsRequest,
            ),
          };
        } else {
          return {
            rawStakingRewards: await this.fetchStakingRewardsViaSubscan(
              stakingRewardsRequest,
            ),
            aggregatedRewards: [],
          };
        }
      default:
        return {
          rawStakingRewards: await this.fetchStakingRewardsViaSubscan(
            stakingRewardsRequest,
          ),
          aggregatedRewards: [],
        };
    }
  }
}
