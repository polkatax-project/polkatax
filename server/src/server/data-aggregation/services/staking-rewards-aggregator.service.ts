import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { StakingRewardsService } from "../../blockchain/substrate/services/staking-rewards.service";
import { StakingRewardsRequest } from "../model/staking-rewards.request";
import { isEvmAddress } from "../helper/is-evm-address";
import { AggregatedStakingReward } from "../model/aggregated-staking-reward";
import { StakingReward } from "../../blockchain/substrate/model/staking-reward";
import { DataPlatformStakingService } from "../../data-platform-api/data-platform-staking.service";
import * as subscanChains from "../../../../res/gen/subscan-chains.json";
import { logger } from "../../logger/logger";

export class StakingRewardsAggregatorService {
  constructor(
    private stakingRewardsService: StakingRewardsService,
    private subscanService: SubscanService,
    private dataPlatformStakingService: DataPlatformStakingService,
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
      await this.dataPlatformStakingService.fetchAggregatedStakingRewardsForChain(
        stakingRewardsRequest.address,
        stakingRewardsRequest.chain.domain,
      );
    return aggregatedRewards;
  }

  public async fetchStakingRewardsViaSubscan(
    stakingRewardsRequest: StakingRewardsRequest,
  ): Promise<StakingReward[]> {
    return this.fetchFromSubscan(stakingRewardsRequest);
  }

  async fetchStakingRewards(
    stakingRewardsRequest: StakingRewardsRequest,
  ): Promise<{
    rawStakingRewards: StakingReward[];
    aggregatedRewards: AggregatedStakingReward[];
  }> {
    logger.info(
      `Enter fetchStakingRewards for chain ${stakingRewardsRequest.chain.domain} and account ${stakingRewardsRequest.address}`,
    );
    const chain = subscanChains.chains.find(
      (c) => c.domain === stakingRewardsRequest.chain.domain,
    );
    if (!chain || (!chain.pseudoStaking && chain.stakingPallets.length === 0)) {
      logger.info(
        `Exit fetchStakingRewards with zero rewards`,
      );
      return { rawStakingRewards: [], aggregatedRewards: [] };
    }

    switch (stakingRewardsRequest.chain.domain) {
      case "polkadot":
      case "kusama":
      case "hydration":
      case "enjin":
        if (process.env["USE_DATA_PLATFORM_API"] === "true") {
          const data = {
            rawStakingRewards: [],
            aggregatedRewards: await this.fetchStakingRewardsViaPlatformApi(
              stakingRewardsRequest,
            ),
          };
          logger.info(
            `Exit fetchStakingRewards with ${data.aggregatedRewards.length} aggregated rewards`,
          );
          return data
        }
      default:
        const results = {
          rawStakingRewards: await this.fetchStakingRewardsViaSubscan(
            stakingRewardsRequest,
          ),
          aggregatedRewards: [],
        };
        logger.info(
          `Exit fetchStakingRewards with ${results.rawStakingRewards.length} single rewards`,
        );
        return results
    }
  }
}
