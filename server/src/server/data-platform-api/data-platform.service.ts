import BigNumber from "bignumber.js";
import { convertToGenericAddress } from "../../common/util/convert-to-generic-address";
import { logger } from "../logger/logger";
import { DataPlatformApi } from "./data-platform.api";
import { dataPlatformChains } from "./model/data-platform-chains";
import { isValidEvmAddress } from "../../common/util/is-valid-address";
import { SubscanService } from "../blockchain/substrate/api/subscan.service";
import { AggregatedStakingReward } from "../data-aggregation/model/aggregated-staking-reward";
import * as subscanChains from "../../../res/gen/subscan-chains.json";

function endOfDayUTC(dateStr: string): number {
  const dateTimeStr = `${dateStr}T23:59:59.999Z`;
  return new Date(dateTimeStr).getTime();
}

export class DataPlatformService {
  constructor(
    private dataPlatformApi: DataPlatformApi,
    private subscanService: SubscanService,
  ) {}

  async fetchAggregatedStakingRewardsForChain(
    address: string,
    chain: string,
    minDate: string = `${new Date().getUTCFullYear() - 1}-01-01`,
    maxDate: string = `${new Date().getUTCFullYear() - 1}-12-31`,
  ): Promise<AggregatedStakingReward[]> {
    const rewards = await this.fetchAggregatedStakingRewards(
      address,
      minDate,
      maxDate,
    );
    return rewards.find((c) => c.chain === chain).values;
  }

  async fetchAggregatedStakingRewards(
    address: string,
    minDate: string = `${new Date().getUTCFullYear() - 1}-01-01`,
    maxDate: string = `${new Date().getUTCFullYear() - 1}-12-31`,
  ): Promise<{ chain: string; values: AggregatedStakingReward[] }[]> {
    logger.info(`Entry fetchAggregatedStakingRewards for ${address}`);
    const genericAddress = isValidEvmAddress(address)
      ? address
      : convertToGenericAddress(address);
    const rewards = await this.dataPlatformApi.fetch(
      genericAddress,
      minDate,
      maxDate,
    );
    const results: { chain: string; values: AggregatedStakingReward[] }[] = [];
    const tokens = await this.subscanService.fetchNativeTokens(
      dataPlatformChains.map((c) => c.domain),
    );

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
      const symbol = subscanChains.chains.find(
        (c) => c.domain === domain,
      )?.token;
      const token = tokens[domain];
      const aggregatedRewards = (item.stakingResults || []).map((reward) => {
        return {
          label: "stakingReward",
          provenance: "aggregatedData",
          transfers: [
            {
              symbol,
              amount: BigNumber(reward.totalAmount)
                .multipliedBy(Math.pow(10, -token.token_decimals))
                .toNumber(),
              to: address,
              asset_unique_id: symbol,
              nominationPool: false,
            },
          ],
          timestamp: endOfDayUTC(reward.executionDate),
          isoDate: reward.executionDate,
        };
      });
      aggregatedRewards.push(
        ...(item.nominationPoolResults || []).map((reward) => {
          return {
            label: "stakingReward",
            provenance: "aggregatedData",
            transfers: [
              {
                symbol,
                amount: BigNumber(reward.totalAmount)
                  .multipliedBy(Math.pow(10, -token.token_decimals))
                  .toNumber(),
                to: address,
                asset_unique_id: symbol,
                nominationPool: true,
              },
            ],
            timestamp: endOfDayUTC(reward.executionDate),
            isoDate: reward.executionDate,
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
