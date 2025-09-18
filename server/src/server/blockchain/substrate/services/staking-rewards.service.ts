import { BigNumber } from "bignumber.js";
import { SubscanService } from "../api/subscan.service";
import { StakingReward } from "../model/staking-reward";
import { isEvmAddress } from "../../../data-aggregation/helper/is-evm-address";
import { getNativeToken } from "../../../data-aggregation/helper/get-native-token";
import {
  getPropertyTypeNameValue,
  getPropertyValue,
} from "../../../data-aggregation/services/special-event-processing/helper";
import { EventDetails } from "../model/subscan-event";

export const extractRewardFromEvent = (
  event: EventDetails,
  token: string,
  decimals: number,
): StakingReward => {
  const rawAmount = Number(
    getPropertyValue(["amount", "rewards", "paid_rewards", "payout"], event) ??
      getPropertyTypeNameValue(["BalanceOf"], event),
  );
  return {
    block: event.block_num,
    timestamp: event.timestamp,
    amount: rawAmount / 10 ** decimals,
    hash: event.extrinsic_hash,
    event_index: event.event_index,
    extrinsic_index: event.extrinsic_index,
    asset_unique_id: token,
    symbol: token,
  };
};

export class StakingRewardsService {
  constructor(private subscanService: SubscanService) {}

  private async fetchStakingReardsViaEvents({
    chainName,
    address,
    minDate,
    maxDate,
    module,
    event_id,
    token,
    decimals,
  }): Promise<StakingReward[]> {
    let events = await this.subscanService.searchAllEvents({
      chainName,
      address,
      minDate,
      maxDate,
      module,
      event_id,
    });
    events = events.filter(
      (e) => e.timestamp >= minDate && (!maxDate || e.timestamp <= maxDate),
    );
    const details = await this.subscanService.fetchEventDetails(
      chainName,
      events,
    );
    return details.map((event) =>
      extractRewardFromEvent(event, token, decimals),
    );
  }

  private async fetchNominationPoolStakingRewards({
    chainName,
    address,
    minDate,
    maxDate,
    token,
    decimals,
  }) {
    return this.fetchStakingReardsViaEvents({
      chainName,
      address,
      minDate,
      maxDate,
      module: "nominationpools",
      event_id: "PaidOut",
      token,
      decimals,
    });
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
    maxDate: number;
  }): Promise<StakingReward[]> {
    const token = getNativeToken(chainName);
    const decimals = (await this.subscanService.fetchNativeToken(chainName))
      .token_decimals;
    if (isEvmAddress(address)) {
      address =
        (await this.subscanService.mapToSubstrateAccount(chainName, address)) ||
        address;
    }
    const rewardsSlashes: StakingReward[] = await (async () => {
      switch (chainName) {
        case "mythos":
          return await this.fetchStakingReardsViaEvents({
            module: "collatorstaking",
            event_id: "StakingRewardReceived",
            token,
            decimals,
            chainName,
            address,
            minDate,
            maxDate,
          });
        case "energywebx":
          return await this.fetchStakingReardsViaEvents({
            module: "parachainstaking",
            event_id: "Rewarded",
            token,
            decimals,
            chainName,
            address,
            minDate,
            maxDate,
          });
        case "peaq":
          return await this.fetchStakingReardsViaEvents({
            module: "parachainstaking",
            event_id: "Rewarded",
            token,
            decimals,
            chainName,
            address,
            minDate,
            maxDate,
          });
        case "hydration":
          return await this.fetchStakingReardsViaEvents({
            module: "staking",
            event_id: "RewardsClaimed",
            token,
            decimals,
            chainName,
            address,
            minDate,
            maxDate,
          });
        default:
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
                .dividedBy(10 ** decimals)
                .toNumber() * (reward.event_id === "Slash" ? -1 : 1),
            symbol: token,
            asset_unique_id: token,
          }));
      }
    })();
    const nominationPoolRewards = await this.fetchNominationPoolStakingRewards({
      token,
      decimals,
      chainName,
      address,
      minDate,
      maxDate,
    });
    nominationPoolRewards.forEach((r) => rewardsSlashes.push(r));
    return rewardsSlashes;
  }
}
