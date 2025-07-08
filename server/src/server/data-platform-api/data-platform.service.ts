import BigNumber from "bignumber.js";
import { convertToGenericAddress } from "../../common/util/convert-to-generic-address";
import { formatDate } from "../../common/util/date-utils";
import { PricedStakingReward } from "../data-aggregation/model/priced-staking-reward";
import { logger } from "../logger/logger";
import { DataPlatformApi } from "./data-platform.api";
import { SubscanApi } from "../blockchain/substrate/api/subscan.api";
import { dataPlatformChains } from "./model/data-platform-chains";

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
    address: string,
    minDate: number = Date.UTC(new Date().getUTCFullYear() - 1, 0, 1),
    maxDate: number = Date.UTC(new Date().getUTCFullYear() - 1, 11, 31),
  ): Promise<{ chain: string; values: PricedStakingReward[] }[]> {
    logger.info(`Entry fetchAggregatedStakingRewards for ${address}`);

    const genericAddress = convertToGenericAddress(address);
    const rewards = await this.dataPlatformApi.fetch(
      genericAddress,
      formatDate(new Date(minDate)),
      formatDate(new Date(maxDate)),
    );
    const results: { chain: string; values: PricedStakingReward[] }[] = [];
    for (let idx = 0; idx < dataPlatformChains.length; idx++) {
      const item = rewards.items.find(
        (i) => i.chainType === dataPlatformChains[idx].chainType,
      ) ?? {
        chainType: dataPlatformChains[idx].chainType,
        stakingResults: [],
        nominationPoolResults: [],
      };
      const domain = dataPlatformChains.find(
        (c) => c.chainType === item.chainType,
      )?.domain;
      const token = await this.subscanApi.fetchNativeToken(domain);
      const aggregatedRewards = (item.stakingResults || []).map((reward) => {
        return {
          amount: BigNumber(reward.totalAmount)
            .multipliedBy(Math.pow(10, -token.token_decimals))
            .toNumber(),
          timestamp: endOfDayUTC(reward.executionDate),
          isoDate: reward.executionDate
        };
      });
      aggregatedRewards.push(
        ...(item.nominationPoolResults || []).map((reward) => {
          return {
            amount: BigNumber(reward.totalAmount)
              .multipliedBy(Math.pow(10, -token.token_decimals))
              .toNumber(),
            timestamp: endOfDayUTC(reward.executionDate),
            nominationPool: true,
            isoDate: reward.executionDate
          };
        }),
      );
      aggregatedRewards.sort((a, b) => a.timestamp - b.timestamp);
      results.push({ chain: domain, values: aggregatedRewards });
    }
    logger.info(`Exit fetchAggregatedStakingRewards for ${address}`);
    return results;
  }
}
