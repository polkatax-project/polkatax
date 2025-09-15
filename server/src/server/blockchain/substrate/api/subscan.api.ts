import { Token } from "../model/token";
import { Block } from "../model/block";
import { RawStakingReward } from "../model/staking-reward";
import { BigNumber } from "bignumber.js";
import { Transaction, TransactionDetails } from "../model/transaction";
import { RequestHelper } from "../../../../common/util/request.helper";
import { RuntimeMetaData } from "../model/runtime-meta-data";
import { EventDetails, SubscanEvent } from "../model/subscan-event";
import {
  RawEvmTransferDto,
  RawSubstrateTransferDto,
} from "../model/raw-transfer";
import { logger } from "../../../logger/logger";
import { throttledApiCall } from "./request-queue";
import { HttpError } from "../../../../common/error/HttpError";
import { RawXcmMessage } from "../model/xcm-transfer";
import { ForeignAsset } from "../model/foreign-asset";
import { Asset } from "../model/asset";
import { FetchedDataRepository } from "../../../../common/util/fetched-data.repository";
import { ResponseCache } from "../../../../common/util/response.cache";

export class SubscanApi {
  private requestHelper: RequestHelper;
  private responseCache: ResponseCache;

  constructor() {
    if (!process.env["SUBSCAN_API_KEY"]) {
      throw Error(
        "Subscan api key not found. It must be provided as env var SUBSCAN_API_KEY",
      );
    }
    this.requestHelper = new RequestHelper();
    this.requestHelper.defaultHeader = {
      "Content-Type": "application/json",
      "x-api-key": process.env["SUBSCAN_API_KEY"],
    };
    this.responseCache = new ResponseCache(
      new FetchedDataRepository(),
      this.requestHelper,
    );
  }

  private async retry<T>(
    query: () => Promise<T>,
    retries = 3,
    backOff = [3000, 5000, 8000],
  ): Promise<T> {
    for (let i = 0; i <= retries; i++) {
      try {
        return await query();
      } catch (e) {
        logger.warn(e, "Request failed. Attempt number " + i);
        if (
          i >= retries ||
          ((e as HttpError).statusCode !== 429 &&
            (e as HttpError).statusCode !== 500)
        )
          throw e;
        await new Promise((res) =>
          setTimeout(() => {
            logger.info("Retry request");
            res(true);
          }, backOff[i]),
        );
      }
    }
  }

  private async request(
    url: string,
    method: string,
    body: any,
    cacheDurationInHours?: number,
  ) {
    if (cacheDurationInHours) {
      const fromStore = await this.responseCache.tryFetchDataFromStore(
        url,
        method,
        body,
      );
      if (fromStore !== undefined) {
        return fromStore;
      }
    }
    return this.retry(() =>
      throttledApiCall(() =>
        cacheDurationInHours
          ? this.responseCache.fetchAndStoreData(
              url,
              method,
              body,
              cacheDurationInHours,
            )
          : this.requestHelper.req(url, method, body),
      ),
    );
  }

  async mapToSubstrateAccount(
    chainName: string,
    account: string,
  ): Promise<string> {
    const response = await this.request(
      `https://${chainName}.api.subscan.io/api/v2/scan/search`,
      "post",
      { key: account },
    );
    const info = response.data;
    return info?.account?.substrate_account?.address;
  }

  async searchEvents(
    chainName: string,
    address: string,
    module: string,
    event_id: string,
    page: number,
    minDate: number,
    block_range?: string,
  ): Promise<{ list: SubscanEvent[]; hasNext: boolean }> {
    const response = await this.request(
      `https://${chainName}.api.subscan.io/api/v2/scan/events`,
      "post",
      {
        row: 100,
        page,
        address,
        module,
        event_id,
        block_range,
        success: true,
        finalized: true,
      },
    );
    const data = (response.data?.events ?? []).map((e) => ({
      ...e,
      timestamp: e.block_timestamp * 1000,
    }));
    return {
      list: data,
      hasNext: data.length >= 100 && data[data.length - 1].timestamp >= minDate,
    };
  }

  async fetchEventDetails(
    chainName: string,
    event_index: string,
  ): Promise<EventDetails> {
    const response = await this.request(
      `https://${chainName}.api.subscan.io/api/scan/event`,
      `post`,
      { event_index },
    );
    return {
      ...response.data,
      extrinsic_index:
        response.data.event_index.split("-")[0] +
        "-" +
        response.data.extrinsic_idx,
    };
  }

  async fetchForeignAssets(
    chainName: string,
    page: number,
  ): Promise<{ list: ForeignAsset[]; hasNext: boolean }> {
    const response = await this.request(
      `https://${chainName}.api.subscan.io/api/scan/foreignAssets/assets`,
      `post`,
      {
        page,
        row: 100,
      },
      24,
    );
    const list = response?.data?.list ?? [];
    return {
      list: list.map((asset) => {
        return {
          ...asset,
          ...(asset?.metadata || {}),
          id: asset.unique_id,
        };
      }),
      hasNext: list.length >= 100,
    };
  }

  /**
   *
   * @param chainName Not supported by assethub
   * @returns
   */
  async scanTokens(chainName: string): Promise<Asset[]> {
    const response = await this.request(
      `https://${chainName}.api.subscan.io/api/v2/scan/tokens`,
      `post`,
      {},
      24,
    );
    return (response?.data?.tokens ?? []).map((t) => {
      return {
        ...t,
        asset_id: t.currency_id,
        decimals: t.decimals ?? t?.metadata?.decimals,
        symbol: t.symbol ?? t?.metadata?.symbol,
        native: t?.metadata?.native ?? false,
      };
    });
  }

  /**
   *
   * @param chainName Supported by assethub but not by Bifrost, Hydration...
   * @returns
   */
  async scanAssets(
    chainName: string,
    page: number,
  ): Promise<{ list: Asset[]; hasNext: boolean }> {
    const response = await this.request(
      `https://${chainName}.api.subscan.io/api/scan/assets/assets`,
      `post`,
      {
        page,
        row: 100,
      },
      24,
    );
    const list = response?.data?.list ?? [];
    return {
      list: list.map((asset) => {
        return {
          ...asset,
          ...(asset?.metadata || {}),
          id: asset.unique_id,
        };
      }),
      hasNext: list.length >= 100,
    };
  }

  async fetchRuntimeMetadata(chainName: string): Promise<RuntimeMetaData> {
    const response = await this.request(
      `https://${chainName}.api.subscan.io/api/scan/runtime/metadata`,
      `post`,
      {},
    );
    return response.data;
  }

  async fetchAccountTokens(chainName: string, address: string) {
    const response = await this.request(
      `https://${chainName}.api.subscan.io/api/scan/account/tokens`,
      `post`,
      {
        address,
      },
    );
    return response.data;
  }

  async fetchNativeToken(chainName: string): Promise<Token> {
    const response = await this.request(
      `https://${chainName}.api.subscan.io/api/scan/token`,
      `post`,
      {},
      24,
    );
    const data = response?.data;
    return Object.values(data?.detail ?? {}).find(
      (value: Token & { asset_type: string }) => value.asset_type === `native`,
    ) as Token;
  }

  async fetchExtrinsicDetails(
    chainName: string,
    extrinsic_index: string,
  ): Promise<TransactionDetails> {
    const response = await this.request(
      `https://${chainName}.api.subscan.io/api/scan/extrinsic`,
      `post`,
      {
        extrinsic_index,
      },
    );
    const timestamp = response.data.block_timestamp * 1000;
    return response.data
      ? {
          ...this.mapExtrinsicData(response.data),
          event: response.data.event.map((e) => ({
            ...e,
            extrinsic_index: response.data.extrinsic_index,
            timestamp,
            params: e.params ? JSON.parse(e.params) : undefined,
            original_event_index: `${e.event_index.split("-")[0]}-${e.event_idx}`,
            event_index: `${e.event_index.split("-")[0]}-${e.event_idx}`,
          })),
        }
      : response.data;
  }

  async fetchBlock(
    chainName: string,
    block_num?: number,
    block_timestamp?: number,
  ): Promise<Block> {
    const response = await this.request(
      `https://${chainName}.api.subscan.io/api/scan/block`,
      `post`,
      {
        block_num,
        block_timestamp,
        only_head: true,
      },
      24,
    );
    return response.data
      ? {
          ...response.data,
          timestamp: response.data.block_timestamp * 1000,
        }
      : response.data;
  }

  async fetchBlockList(
    chainName: string,
    page = 0,
    minDate: number,
  ): Promise<{ list: Block[]; hasNext: boolean }> {
    const response = await this.request(
      `https://${chainName}.api.subscan.io/api/v2/scan/blocks`,
      `post`,
      {
        page,
        row: 100,
      },
    );
    const list = response.data.blocks.map((b) => ({
      id: b.block_num,
      block_num: b.block_num,
      timestamp: b.block_timestamp * 1000,
    }));
    return {
      list,
      hasNext: list.length >= 100 && list[list.length - 1].timestamp >= minDate,
    };
  }

  private mapStakingRewards(
    rawResponseList: any[] | undefined,
  ): RawStakingReward[] {
    return (rawResponseList || []).map((entry) => {
      return {
        id: entry.event_index,
        event_id: entry.event_id,
        amount: BigNumber(entry.amount),
        timestamp: entry.block_timestamp * 1000, // convert from sec to ms
        block: entry.block_num ?? Number(entry.extrinsic_index.split("-")[0]),
        hash: entry.extrinsic_hash,
        extrinsic_index: entry.extrinsic_index,
        event_index: entry.event_index,
      };
    });
  }

  async fetchStakingRewards(
    chainName: string,
    address: string,
    page: number = 0,
    isStash: boolean,
    minDate: number,
    block_range?: string,
  ): Promise<{ list: RawStakingReward[]; hasNext: boolean }> {
    const responseBody = await this.request(
      `https://${chainName}.api.subscan.io/api/scan/account/reward_slash`,
      `post`,
      {
        row: 100,
        page,
        address,
        is_stash: isStash,
        block_range,
      },
    );
    const list = this.mapStakingRewards(responseBody.data?.list || []);
    return {
      list,
      hasNext: list.length >= 100 && list[list.length - 1].timestamp >= minDate,
    };
  }

  async fetchAccounts(address: string, chainName: string): Promise<string[]> {
    const json = await this.request(
      `https://${chainName}.api.subscan.io/api/v2/scan/accounts`,
      `post`,
      {
        address: [address],
        row: 100,
      },
    );
    return (json?.data?.list ?? []).map((entry) => entry.address);
  }

  async fetchBalanceHistory(
    address: string,
    chainName: string,
    token_unique_id?: string,
    start?: string,
    end?: string,
  ): Promise<{ block?: number; date?: string; balance: string }[]> {
    const json = await this.request(
      `https://${chainName}.api.subscan.io/api/scan/account/balance_history`,
      `post`,
      {
        address,
        recent_block: 10000,
        token_unique_id,
        start,
        end,
      },
    );
    return json?.data?.history;
  }

  async fetchXcmList(
    chainName: string,
    address: string,
    page: number = 0,
    minDate: number,
    block_range?: string,
    filter_para_id?: number,
  ): Promise<{ list: RawXcmMessage[]; hasNext: boolean }> {
    if (process.env["DELEGATE_XCM_REQUESTS_TO"]) {
      logger.info(
        `Delegated XCM transfer to ${process.env["DELEGATE_XCM_REQUESTS_TO"]} for address ${address} and chain ${chainName}`,
      );
      return this.request(process.env["DELEGATE_XCM_REQUESTS_TO"], `post`, {
        chainName,
        address,
        page,
        minDate,
        block_range,
        filter_para_id,
      });
    }
    if (process.env["XCM_DISABLED"] === "true") {
      logger.info("Skipping fetchXcmTransfers");
      return { hasNext: false, list: [] };
    }
    const json = await this.request(
      `https://${chainName}.api.subscan.io/api/scan/xcm/list`,
      `post`,
      {
        row: 100,
        page,
        address,
        block_range,
        filter_para_id,
      },
      6,
    );
    const list = (json?.data?.list || []).map((xcm) => {
      return {
        ...xcm,
        id: xcm.unique_id,
        origin_block_timestamp: xcm.origin_block_timestamp * 1000,
        relayed_block_timestamp: xcm.relayed_block_timestamp * 1000,
        confirm_block_timestamp: xcm.confirm_block_timestamp * 1000,
      };
    });
    return {
      list: list.filter((xcm) => xcm.status !== "failed"),
      hasNext:
        list.length >= 100 &&
        list[list.length - 1].origin_block_timestamp >= minDate,
    };
  }

  private mapExtrinsicData(entry: any): Transaction {
    return {
      id: entry.id,
      hash: entry.extrinsic_hash,
      from: entry.account_display.address,
      to: entry.to,
      timestamp: entry.block_timestamp * 1000, // sec -> ms
      block: entry.block_num,
      callModule: entry.call_module,
      callModuleFunction: entry.call_module_function,
      amount: entry.value ? Number(entry.value) : 0,
      extrinsic_index: entry.extrinsic_index,
      fee: entry.fee ? Number(entry.fee) : undefined,
      feeUsed: entry.fee_used ? Number(entry.fee_used) : undefined,
      tip: entry.fee_used ? Number(entry.tip) : undefined,
    };
  }

  async fetchExtrinsics(
    chainName: string,
    address: string,
    page: number = 0,
    minDate: number,
    block_range?: string,
    evm = false,
  ): Promise<{ list: Transaction[]; hasNext: boolean }> {
    const responseBody = await this.request(
      `https://${chainName}.api.subscan.io/api/v2/scan/extrinsics`,
      `post`,
      {
        row: 100,
        page,
        address,
        block_range,
      },
    );
    const resultList = (
      responseBody.data?.extrinsics ||
      responseBody.data?.list ||
      []
    ).map((entry) => {
      return this.mapExtrinsicData(entry);
    });
    return {
      list: resultList,
      hasNext:
        resultList.length >= 100 &&
        resultList[resultList.length - 1].timestamp >= minDate,
    };
  }

  async fetchTransfers(
    chainName: string,
    account: string,
    page: number = 0,
    minDate: number,
    block_range?: string,
  ): Promise<{
    list: (RawSubstrateTransferDto &
      RawEvmTransferDto & { timestamp: number; id: number })[];
    hasNext: boolean;
  }> {
    const responseBody = await this.request(
      `https://${chainName}.api.subscan.io/api/v2/scan/transfers`,
      `post`,
      {
        row: 100,
        page,
        address: account,
        success: true,
        block_range,
      },
    );
    const list = (
      responseBody.data?.transfers ||
      responseBody.data?.list ||
      []
    ).map((t) => ({
      ...t,
      id: t.transfer_id,
      timestamp: (t.block_timestamp || t.create_at) * 1000,
    }));
    return {
      list,
      hasNext: list.length >= 100 && list[list.length - 1].timestamp >= minDate,
    };
  }

  async fetchMetadata(chainName: string): Promise<{
    avgBlockTime: number;
    blockNum: number;
  }> {
    const response = await this.requestHelper.req(
      `https://${chainName}.api.subscan.io/api/scan/metadata`,
      `post`,
      {},
    );
    const meta = response.data;
    return {
      avgBlockTime: Number(meta.avgBlockTime) || Number(meta.blockTime),
      blockNum: Number(meta.blockNum),
    };
  }
}
