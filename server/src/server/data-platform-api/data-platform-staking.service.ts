import BigNumber from "bignumber.js";
import { convertToGenericAddress } from "../../common/util/convert-to-generic-address";
import { logger } from "../logger/logger";
import { DataPlatformApi } from "./data-platform.api";
import { dataPlatformChains } from "./model/data-platform-chains";
import { isValidEvmAddress } from "../../common/util/is-valid-address";
import { SubscanService } from "../blockchain/substrate/api/subscan.service";
import { AggregatedStakingReward } from "../data-aggregation/model/aggregated-staking-reward";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { StakingResults } from "./model/staking-results";
import { ChainSlashes } from "./model/chain-slashes";

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
    logger.info(
      `Entry fetchAggregatedStakingRewards for ${address} and chain ${chain}`,
    );
    const { stakingResults, chainSlashes } =
      await this.fetchAggregatedStakingResults(
        address,
        chain,
        minDate,
        maxDate,
      );
    const rewards = await this.mapToAggregatedStakingRewards(
      address,
      chain,
      stakingResults,
      chainSlashes,
    );
    logger.info(
      `Exit fetchAggregatedStakingRewards with ${rewards.length} entries`,
    );
    return rewards;
  }

  private async mapToAggregatedStakingRewards(
    address: string,
    domain: string,
    stakingResults: StakingResults,
    chainSlashes: ChainSlashes,
  ): Promise<AggregatedStakingReward[]> {
    const token = await this.subscanService.fetchNativeToken(domain);
    const symbol = subscanChains.chains.find((c) => c.domain === domain)?.token;
    const rewardToTransfer = (reward: { totalAmount; executionDate }) => ({
      label: "Staking reward" as const,
      provenance: "aggregatedData" as const,
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
    });

    const aggregatedRewards: AggregatedStakingReward[] = (
      stakingResults?.stakingResults || []
    ).map((reward) => rewardToTransfer(reward));
    (stakingResults?.nominationPoolResults || []).forEach((reward) =>
      rewardToTransfer(reward),
    );

    const slashToTransfer = (slash: { totalAmount; executionDate }) => {
      const transfer = rewardToTransfer(slash);
      return {
        ...transfer,
        label: "Staking slashed" as const,
        transfers: transfer.transfers.map((t) => ({
          ...t,
          amount: -t.amount,
        })),
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

  private async fetchAggregatedStakingResults(
    address: string,
    domain: string,
    minDate: string = `${new Date().getUTCFullYear() - 1}-01-01`,
    maxDate: string = `${new Date().getUTCFullYear() - 1}-12-31`,
  ): Promise<{ stakingResults: StakingResults; chainSlashes: ChainSlashes }> {
    logger.info(`Entry fetchAggregatedStakingRewards for ${address}`);
    const genericAddress = isValidEvmAddress(address)
      ? address
      : convertToGenericAddress(address);
    const rewards = await this.dataPlatformApi.fetchStakingRewards(
      genericAddress,
      minDate,
      maxDate,
    );
    const slashes = await this.dataPlatformApi.fetchStakingSlashes(
      genericAddress,
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
