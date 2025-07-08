import BigNumber from "bignumber.js";
import { convertToGenericAddress } from "../../common/util/convert-to-generic-address";
import { formatDate } from "../../common/util/date-utils";
import { PricedStakingReward } from "../data-aggregation/model/priced-staking-reward";
import { logger } from "../logger/logger";
import { DataPlatformApi } from "./data-platform.api";
import { SubscanApi } from "../blockchain/substrate/api/subscan.api";

function endOfDayUTC(dateStr: string): number {
  const dateTimeStr = `${dateStr}T23:59:59.999Z`;
  return new Date(dateTimeStr).getTime();
}

export class DataPlatformService {
  constructor(
    private dataPlatformApi: DataPlatformApi,
    private subscanApi: SubscanApi,
  ) {}

  async fetchAggregatedStakingRewards(
    chainName: string,
    address: string,
    minDate: number = Date.UTC(new Date().getUTCFullYear() - 1, 0, 1),
    maxDate: number = Date.UTC(new Date().getUTCFullYear() - 1, 11, 31),
  ): Promise<PricedStakingReward[]> {
    logger.info(
      `Entry fetchAggregatedStakingRewards for ${address} on ${chainName}`,
    );
    const token = await this.subscanApi.fetchNativeToken(chainName);
    const genericAddress = convertToGenericAddress(address);
    const rewards = await this.dataPlatformApi.fetch(
      genericAddress,
      formatDate(new Date(minDate)),
      formatDate(new Date(maxDate)),
    );
    const rewardsForChain = rewards.items.find(
      (i) => i.chainType.toLocaleLowerCase() === chainName,
    );
    if (!rewardsForChain) {
      return [];
    }
    const aggregatedRewards = (rewardsForChain.stakingResults || []).map(
      (reward) => {
        return {
          amount: BigNumber(reward.totalAmount)
            .multipliedBy(Math.pow(10, -token.token_decimals))
            .toNumber(),
          timestamp: endOfDayUTC(reward.executionDate),
        };
      },
    );
    aggregatedRewards.push(
      ...(rewardsForChain.nominationPoolResults || []).map((reward) => {
        return {
          amount: BigNumber(reward.totalAmount)
            .multipliedBy(Math.pow(10, -token.token_decimals))
            .toNumber(),
          timestamp: endOfDayUTC(reward.executionDate),
          nominationPool: true,
        };
      }),
    );
    aggregatedRewards.sort((a, b) => a.timestamp - b.timestamp);
    logger.info(
      `Exit fetchAggregatedStakingRewards for ${address} on ${chainName} with ${aggregatedRewards.length} entries`,
    );
    return aggregatedRewards;
  }
}
