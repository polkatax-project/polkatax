import { BigNumber } from "bignumber.js";
import { SubscanService } from "../api/subscan.service";
import { StakingReward } from "../model/staking-reward";
import { isEvmAddress } from "../../../data-aggregation/helper/is-evm-address";
import { getNativeToken } from "../../../data-aggregation/helper/get-native-token";

export class StakingRewardsService {
  constructor(private subscanService: SubscanService) {}

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
      asset_unique_id: nativeToken,
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
    if (isEvmAddress(address)) {
      address =
        (await this.subscanService.mapToSubstrateAccount(chainName, address)) ||
        address;
    }
    const rewardsSlashes = await (async () => {
      switch (chainName) {
        case "mythos":
        case "acala":
        case "energywebx":
        case "darwinia":
        case "robonomics-freemium":
        case "peaq":
        case "hydration":
          return []; // staking rewards are return as transfers for these chains.
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
    return filtered;
  }
}
