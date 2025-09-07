import BigNumber from "bignumber.js";
import { logger } from "../logger/logger";
import { DataPlatformApi } from "./data-platform.api";
import { dataPlatformChains } from "./model/data-platform-chains";
import { SubscanService } from "../blockchain/substrate/api/subscan.service";
import { AggregatedStakingReward } from "../data-aggregation/model/aggregated-staking-reward";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { ChainSlashes } from "./model/chain-slashes";
import { StakingResultsDetailed } from "./model/staking-results";
import { toSubscanExtrinsixIndex } from "./helper/to-subscan-extrinsic-id";
import { parseCETDate } from "./helper/parse-cet-date";

function endOfDayUTC(dateStr: string): number {
  const dateTimeStr = `${dateStr}T23:59:59.999Z`;
  return new Date(dateTimeStr).getTime();
}

export class DataPlatformStakingService {
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
    logger.info(`Entry fetchStakingRewards for ${address} and chain ${chain}`);
    const { stakingResults, chainSlashes } = await this.fetchRewards(
      address,
      chain,
      minDate,
      maxDate,
    );
    const rewards = await this.mapToDataPlatformStakingRewards(
      address,
      chain,
      stakingResults,
      chainSlashes,
    );
    logger.info(`Exit fetchStakingRewards with ${rewards.length} entries`);
    return rewards;
  }

  private async mapToDataPlatformStakingRewards(
    address: string,
    domain: string,
    stakingResults: StakingResultsDetailed,
    chainSlashes: ChainSlashes,
  ): Promise<AggregatedStakingReward[]> {
    const token = await this.subscanService.fetchNativeToken(domain);
    const symbol = subscanChains.chains.find((c) => c.domain === domain)?.token;
    const rewardToTransfer = (reward: {
      amount;
      blockTimestamp;
      blockNumber;
      extrinsicId;
    }): any => ({
      label: "Staking reward" as const,
      provenance: "dataPlatformApi" as const,
      transfers: [
        {
          symbol,
          amount: BigNumber(reward.amount)
            .multipliedBy(Math.pow(10, -token.token_decimals))
            .toNumber(),
          to: address,
          asset_unique_id: symbol,
        },
      ],
      timestamp: parseCETDate(reward.blockTimestamp),
      block: reward.blockNumber,
      extrinsic_index: toSubscanExtrinsixIndex(reward.extrinsicId),
    });

    const aggregatedRewards: AggregatedStakingReward[] = (
      stakingResults?.stakingResults || []
    ).map((reward) => rewardToTransfer(reward));
    (stakingResults?.nominationPoolResults || []).forEach((reward) =>
      rewardToTransfer(reward),
    );

    const slashToTransfer = (slash: { totalAmount; executionDate }) => {
      return {
        label: "Staking slashed" as const,
        provenance: "aggregatedData" as const,
        transfers: [
          {
            symbol,
            amount: -BigNumber(slash.totalAmount)
              .multipliedBy(Math.pow(10, -token.token_decimals))
              .toNumber(),
            to: address,
            asset_unique_id: symbol,
            nominationPool: true,
          },
        ],
        timestamp: endOfDayUTC(slash.executionDate),
      };
    };
    (chainSlashes?.balanceSlashingResults || []).forEach((slash) => {
      aggregatedRewards.push(slashToTransfer(slash));
    });
    (chainSlashes?.stakingSlashingResults || []).forEach((slash) => {
      aggregatedRewards.push(slashToTransfer(slash));
    });
    aggregatedRewards.sort((a, b) => a.timestamp - b.timestamp);
    return aggregatedRewards;
  }

  private async fetchRewards(
    address: string,
    domain: string,
    minDate: string = `${new Date().getUTCFullYear() - 1}-01-01`,
    maxDate: string = `${new Date().getUTCFullYear() - 1}-12-31`,
  ): Promise<{
    stakingResults: StakingResultsDetailed;
    chainSlashes: ChainSlashes;
  }> {
    logger.info(`Entry fetchRewards for ${address}`);
    const rewards = await this.dataPlatformApi.fetchStakingRewards(
      address,
      minDate,
      maxDate,
    );
    const slashes = await this.dataPlatformApi.fetchStakingSlashes(
      address,
      minDate,
      maxDate,
    );
    const chainType = dataPlatformChains.find(
      (c) => c.domain === domain,
    ).chainType;
    return {
      stakingResults: rewards.items.find((r) => r.chainType === chainType),
      chainSlashes: slashes.items.find((r) => r.chainType === chainType),
    };
  }
}
