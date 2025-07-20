import { BigNumber } from "bignumber.js";
import { SubscanService } from "../api/subscan.service";
import { StakingReward } from "../model/staking-reward";
import { logger } from "../../../logger/logger";
import { StakingRewardsViaEventsService } from "./staking-rewards-via-events.service";
import { isEvmAddress } from "../../../data-aggregation/helper/is-evm-address";
import { getNativeToken } from "../../../data-aggregation/helper/get-native-token";

export class StakingRewardsService {
  constructor(
    private subscanService: SubscanService,
    private stakingRewardsViaEventsService: StakingRewardsViaEventsService,
  ) {}

  private async mapRawRewards(
    nativeToken: string,
    rewards: StakingReward[],
  ): Promise<StakingReward[]> {
    return rewards.map((reward) => ({
      block: reward.block,
      timestamp: reward.timestamp,
      amount: reward.amount,
      hash: reward.hash,
      event_index: reward.event_index,
      extrinsic_index: reward.extrinsic_index,
      asset_unique_id: reward.asset_unique_id ?? nativeToken,
    }));
  }

  async fetchStakingRewards({
    chainName,
    address,
    minDate,
    maxDate,
  }: {
    chainName: string;
    address: string;
    minDate: number;
    maxDate?: number;
  }): Promise<StakingReward[]> {
    logger.info(
      `Entry fetchStakingRewards for address ${address} and chain ${chainName}`,
    );
    if (isEvmAddress(address)) {
      address =
        (await this.subscanService.mapToSubstrateAccount(chainName, address)) ||
        address;
    }
    const rewardsSlashes = await (async () => {
      switch (chainName) {
        /*case "mythos":
          return this.stakingRewardsViaEventsService.fetchStakingRewards(
            chainName,
            address,
            "collatorstaking",
            "StakingRewardReceived",
            minDate,
            maxDate,
          );*/ // TODO: reactivate?!
        case "energywebx":
          return this.stakingRewardsViaEventsService.fetchStakingRewards(
            chainName,
            address,
            "parachainstaking",
            "Rewarded",
            minDate,
            maxDate,
          );
        case "darwinia":
          return this.stakingRewardsViaEventsService.fetchStakingRewards(
            chainName,
            address,
            "darwiniastaking",
            "RewardAllocated",
            minDate,
            maxDate,
          );
        case "robonomics-freemium":
          return this.stakingRewardsViaEventsService.fetchStakingRewards(
            chainName,
            address,
            "staking",
            "reward",
            minDate,
            maxDate,
          );
        case 'mythos':
        case 'acala':
          return [] // staking rewards are transfers as well -> prevent duplicates
        default:
          const token = await this.subscanService.fetchNativeToken(chainName);
          const rawRewards = await this.subscanService.fetchAllStakingRewards({
            chainName,
            address,
            minDate,
            maxDate,
          });
          return rawRewards.map((reward) => ({
            ...reward,
            amount:
              BigNumber(reward.amount)
                .dividedBy(Math.pow(10, token.token_decimals))
                .toNumber() * (reward.event_id === "Slash" ? -1 : 1),
          }));
      }
    })();
    const filtered = await this.mapRawRewards(
      getNativeToken(chainName),
      rewardsSlashes as StakingReward[],
    );
    logger.info(`Exit fetchStakingRewards with ${filtered.length} elements`);
    return filtered;
  }
}
