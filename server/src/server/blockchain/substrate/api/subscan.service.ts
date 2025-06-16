import { Token } from "../model/token";
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
    return this.filterOnDate(
      await this.iterateOverPagesParallel<SubscanEvent>((page) =>
        this.subscanApi.searchEvents(
          chainName,
          address,
          module,
          event_id,
          page,
          minDate,
        ),
      ),
      minDate,
      maxDate,
    );
  }

  async searchAllExtrinsics(
    chainName: string,
    address: string,
    module: string,
    call: string,
    block_min?: number,
    block_max?: number,
  ): Promise<Transaction[]> {
    return this.iterateOverPagesParallel<Transaction>((page) =>
      this.subscanApi.searchExtrinsics(
        chainName,
        address,
        module,
        call,
        page,
        block_min,
        block_max,
      ),
    );
  }

  private async iterateOverPagesParallel<T>(
    fetchPages: (page) => Promise<{ list: T[]; hasNext: boolean }>,
    count = 5,
  ): Promise<T[]> {
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
    } while (hasNext);
    return result;
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
        ),
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
      await this.iterateOverPagesParallel<Transaction>((page) =>
        this.subscanApi.fetchExtrinsics(chainName, address, page, minDate, evm),
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
    >((page) =>
      this.subscanApi.fetchTransfers(chainName, address, page, minDate, evm),
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
}
