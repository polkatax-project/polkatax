import { Token, TokenInfo } from "../model/token";
import { Transaction } from "../model/transaction";
import { RawStakingReward } from "../model/staking-reward";
import { SubscanApi } from "./subscan.api";
import { logger } from "../../../logger/logger";
import { EventDetails, SubscanEvent } from "../model/subscan-event";
import {
  RawEvmTransferDto,
  RawSubstrateTransferDto,
  Transfer,
} from "../model/raw-transfer";
import { RawXcmMessage } from "../model/xcm-transfer";
import { Block } from "../model/block";
import { ForeignAsset } from "../model/foreign-asset";
import { Asset } from "../model/asset";

export class SubscanService {
  constructor(private subscanApi: SubscanApi) {}

  async mapToSubstrateAccount(
    chainName: string,
    account: string,
  ): Promise<string> {
    logger.info(
      `Enter mapToSubstrateAccount for chain ${chainName} and account ${account}`,
    );
    const address = await this.subscanApi.mapToSubstrateAccount(
      chainName,
      account,
    );
    logger.info(`Exit mapToSubstrateAccount with address ${address}`);
    return address;
  }

  async fetchNativeToken(chainName: string): Promise<Token> {
    return this.subscanApi.fetchNativeToken(chainName);
  }

  async searchAllEvents({
    chainName,
    address,
    module,
    event_id,
    minDate,
    maxDate,
  }: {
    chainName: string;
    address: string;
    module?: string;
    event_id?: string;
    minDate: number;
    maxDate?: number;
  }): Promise<SubscanEvent[]> {
    logger.info(
      `Enter searchAllEvents for chain ${chainName} and account ${address}`,
    );
    const result = await this.filterOnDate(
      await this.iterateOverPagesParallel<SubscanEvent>((page, after_id) =>
        this.subscanApi.searchEvents(
          chainName,
          address,
          module,
          event_id,
          page,
          minDate,
          after_id
        ),
        { withAfterId: true }
      ),
      minDate,
      maxDate,
    );
    logger.info(
      `Exit searchAllEvents for chain ${chainName} and account ${address}`,
    );
    return result
  }

  private async iterateOverPagesParallel<T>(
    fetchPages: (page, after_id?) => Promise<{ list: T[]; hasNext: boolean }>,
    options?: { count?: number, withAfterId?: boolean }
  ): Promise<T[]> {
    const count = options?.count ?? 5
    const withAfterId = options?.withAfterId ?? false
    const parallelFn = [...Array(count).keys()].map(
      (offset) => (page) => fetchPages(page + offset),
    );
    let page = 0;
    const result = [];
    let hasNext = false;
    do {
      const intermediate_results = await Promise.all(
        parallelFn.map((fn) => fn(page)),
      );
      intermediate_results.forEach((intermediate) =>
        result.push(...intermediate.list),
      );
      hasNext = intermediate_results[intermediate_results.length - 1].hasNext;
      page += count;
      if (page >= 100 && withAfterId) {
        const lowestId = result.reduce((curr, next) => { return Math.min(curr, next.id)}, Number.MAX_SAFE_INTEGER)
        logger.info(`Found more than ${result.length} entries. Fetching remaining values via after_id from ${lowestId}`)
        const remaining = await this.fetchWithAfterId(fetchPages, lowestId)
        remaining.forEach(r => result.push(r))
        logger.info(`Found ${result.length} entries.`)
        return result
      }
    } while (hasNext);
    return result;
  }

  private async fetchWithAfterId<T extends { id?: number }>(
    fetchPages: (page, afterId?) => Promise<{ list: T[]; hasNext: boolean }>,
    after_id: number,
  ): Promise<T[]> {
    const result = [];
    let intermediate_result: { hasNext: boolean, list: T []};
    do {
      intermediate_result = await fetchPages(0, after_id)
      intermediate_result.list.forEach(entry => result.push(entry))
      after_id = Math.min(...intermediate_result.list.map(e => e.id))
      if (result.length >= 250000) {
        logger.info(`Found more than ${result.length} entries. Aborting...`)
        return result
      }
    } while (intermediate_result.hasNext);
    return result
  }

  private filterOnDate<T extends { timestamp: number }>(
    values: T[],
    minDate: number,
    maxDate?: number,
  ): T[] {
    return values.filter(
      (r) => (!maxDate || r.timestamp <= maxDate) && r.timestamp >= minDate,
    );
  }

  async fetchAllStakingRewards({
    chainName,
    address,
    minDate,
    maxDate,
  }: {
    chainName: string;
    address: string;
    minDate: number;
    maxDate?: number;
  }): Promise<RawStakingReward[]> {
    logger.info(
      `Enter fetchAllStakingRewards for ${chainName}, address ${address}, starting from ${new Date(minDate).toISOString()}`,
    );
    const rewards = this.filterOnDate(
      await this.iterateOverPagesParallel((page) =>
        this.subscanApi.fetchStakingRewards(
          chainName,
          address,
          page,
          true,
          minDate,
        )
      ),
      minDate,
      maxDate,
    );
    logger.info(`Exit fetchAllStakingRewards`);
    return rewards;
  }

  async fetchXcmList(
    relayChainName: string,
    address: string,
    filter_para_id: number,
    minDate: number,
  ): Promise<RawXcmMessage[]> {
    logger.info(
      `fetchXcmList for ${relayChainName} and address ${address} from ${new Date(minDate).toUTCString()} filtering on para_id ${filter_para_id}.`,
    );
    const result = this.iterateOverPagesParallel<RawXcmMessage>((page) =>
      this.subscanApi.fetchXcmList(
        relayChainName,
        address,
        page,
        filter_para_id,
        minDate,
      ),
    );
    logger.info(
      `Exit fetchXcmList for ${relayChainName} and address ${address} and para_id ${filter_para_id}`,
    );
    return result;
  }

  async fetchEventDetails(
    chainName: string,
    events: SubscanEvent[],
  ): Promise<EventDetails[]> {
    logger.info(
      `Enter fetchEventDetails for ${chainName} and event_indices ${events.map((e) => e.event_index).join(", ")}`,
    );
    const results = await Promise.all(
      events.map((e) =>
        this.subscanApi.fetchEventDetails(chainName, e.event_index),
      ),
    );
    for (let idx = 0; idx < results.length; idx++) {
      results[idx].timestamp = events[idx].timestamp;
      results[idx].original_event_index = events[idx].event_id
    }
    logger.info(`Exit fetchEventDetails`);
    return results;
  }

  async fetchBlockList(chainName: string, minDate): Promise<Block[]> {
    logger.info(
      `Enter fetchBlockList for ${chainName} from date ${new Date(minDate).toISOString()}`,
    );
    const result = this.filterOnDate(
      await this.iterateOverPagesParallel<Block>((page) =>
        this.subscanApi.fetchBlockList(chainName, page, minDate),
      ),
      minDate,
    );
    logger.info(`Exit fetchBlockList`);
    return result;
  }

  async fetchAllTx({
    chainName,
    address,
    minDate,
    maxDate,
    evm,
  }: {
    chainName: string;
    address: string;
    minDate: number;
    maxDate?: number;
    evm?: boolean;
  }): Promise<Transaction[]> {
    logger.info(
      `fetchAllExtrinsics for ${chainName} and address ${address} from ${new Date(minDate).toUTCString()}. Evm ${evm}`,
    );
    const result = this.filterOnDate(
      await this.iterateOverPagesParallel<Transaction>((page, after_id) =>
        this.subscanApi.fetchExtrinsics(chainName, address, page, minDate, after_id, evm),
        { withAfterId: true }
      ),
      minDate,
      maxDate,
    );
    logger.info(
      `Exit fetchAllExtrinsics for ${chainName} and address ${address}`,
    );
    return result;
  }

  async fetchAllTransfers({
    chainName,
    address,
    minDate,
    maxDate,
    evm,
  }: {
    chainName: string;
    address: string;
    minDate: number;
    maxDate?: number;
    evm?: boolean;
  }): Promise<Transfer[]> {
    logger.info(
      `fetchAllTransfers for ${chainName} and address ${address} starting from ${new Date(minDate).toISOString()}. Evm: ${evm}`,
    );
    const result = await this.iterateOverPagesParallel<
      RawSubstrateTransferDto & RawEvmTransferDto & { timestamp: number }
    >((page, after_id) =>
      this.subscanApi.fetchTransfers(chainName, address, page, minDate, after_id ? [after_id] : [], evm),
      { withAfterId: true }
    );
    const filtered = this.filterOnDate(result, minDate, maxDate);
    const mapped = filtered.map((transfer) => {
      return {
        symbol: transfer.symbol || transfer.asset_symbol,
        amount: Number(transfer.amount),
        from: transfer.from,
        to: transfer.to,
        module:
          transfer?.to_display?.evm_contract.contract_name || transfer.module,
        block: transfer.block_num,
        timestamp: transfer.timestamp,
        hash: transfer.hash,
        tokenId: transfer.asset_unique_id || transfer.contract,
        extrinsic_index: transfer.extrinsic_index,
        fiatValue: transfer.currency_amount
          ? Number(transfer.currency_amount)
          : undefined,
        price: transfer.currency_amount
          ? Number(transfer.currency_amount) / Number(transfer.amount)
          : undefined,
        asset_type: transfer.asset_type ? transfer.asset_type : undefined,
      };
    });
    logger.info(
      `Exit fetchAllTransfers for ${chainName} and address ${address}`,
    );
    return mapped;
  }

  async fetchAccounts(address: string, chainName: string): Promise<string[]> {
    return this.subscanApi.fetchAccounts(address, chainName);
  }

  async fetchForeignAssets(chainName: string): Promise<ForeignAsset[]> {
    return this.iterateOverPagesParallel<ForeignAsset>((page) =>
        this.subscanApi.fetchForeignAssets(chainName, page)
      )
  }

  async scanTokens(chainName: string): Promise<TokenInfo[]> {
    return this.subscanApi.scanTokens(chainName)
  }
  
  async scanAssets(chainName: string): Promise<Asset[]> {
    return this.iterateOverPagesParallel<Asset>((page) =>
      this.subscanApi.scanAssets(chainName, page)
    )
  }

}
