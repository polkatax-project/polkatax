import { ApiPromise, WsProvider } from "@polkadot/api";
import { Asset } from "../model/asset";
import { logger } from "../../../logger/logger";
import * as substrateNodesWsEndpoints from "../../../../../res/substrate-nodes-ws-endpoints.json";
import { withTimeout } from "../../../../common/util/with-timeout";
import isEqual from "lodash.isequal";

/**
 * This will normalize object the properties.
 */
function normalizeKeys(value: any): any {
  if (Array.isArray(value)) {
    return value.map((v) => normalizeKeys(v));
  }

  if (value && typeof value === "object" && value.constructor === Object) {
    const result: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      result[key.toLowerCase()] = normalizeKeys(value[key]);
    }
    return result;
  }

  return value; // number, string, boolean, null, etc.
}

export class PolkadotApi {
  private api: ApiPromise;
  private apiAt: ApiPromise;

  constructor(private domain: string) {}

  private async createApi() {
    if (this.api) {
      await this.api.disconnect();
    }
    const provider = new WsProvider(
      substrateNodesWsEndpoints[this.domain],
      5000,
    );

    this.api = await ApiPromise.create({ provider, noInitWarn: true });
  }

  async disconnect() {
    logger.info("Disconnecting Polkadot API");
    if (this.api) {
      await this.api.disconnect();
    }
  }

  async setApiAtWithTimeout(blockNumber: number, timeout = 60_000) {
    return withTimeout(this.setApiAt(blockNumber), timeout);
  }

  async setApiAt(blockNumber: number) {
    await this.createApi();
    const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
    this.apiAt = (await this.api.at(blockHash)) as any;
  }

  async getNativeTokenBalance(address: string): Promise<number> {
    const accountInfo: any = await this.apiAt.query.system.account(address);
    const json = accountInfo.toJSON();
    const nativeBalance =
      Number(BigInt(json.data?.free ?? 0n)) +
      Number(BigInt(json.data?.reserved ?? 0n));
    return nativeBalance;
  }

  private async getAssetBalance(
    address: string,
    token: {
      symbol: string;
      decimals: number;
      unique_id: string;
      asset_id: string;
    },
  ): Promise<{
    asset_unique_id: string;
    symbol: string;
    balance: number;
    native?: boolean;
  }> {
    const balanceInfo = (await this.apiAt.query.assets.account(
      token.asset_id || token.unique_id,
      address,
    )) as any;
    return {
      balance:
        Number(balanceInfo.toJSON()?.balance ?? 0) / 10 ** token.decimals,
      asset_unique_id: token.unique_id,
      symbol: token.symbol,
    };
  }

  async getAssetPortfolioWithTimeout(
    address: string,
    assets: {
      symbol: string;
      decimals: number;
      unique_id: string;
      asset_id: string;
      native: boolean;
    }[],
    timeout = 60_000,
  ): Promise<
    {
      asset_unique_id: string;
      symbol: string;
      balance: number;
      native?: boolean;
    }[]
  > {
    return withTimeout(this.getAssetPortfolio(address, assets), timeout);
  }

  async getAssetPortfolio(
    address: string,
    assets: {
      symbol: string;
      decimals: number;
      unique_id: string;
      asset_id: string;
      native: boolean;
    }[],
  ): Promise<
    {
      asset_unique_id: string;
      symbol: string;
      balance: number;
      native?: boolean;
    }[]
  > {
    const values = await Promise.all(
      assets
        .filter((t) => !t.native)
        .map((t) => this.getAssetBalance(address, t)),
    );
    const nativeBalance = await this.getNativeTokenBalance(address);
    const nativeToken = assets.find((a) => a.native);

    values.push({
      asset_unique_id: nativeToken.unique_id,
      symbol: nativeToken.symbol,
      balance: nativeBalance / 10 ** nativeToken.decimals,
      native: true,
    });
    return values;
  }

  async getTokenPortfolioWithTimeout(
    address: string,
    assets: Asset[],
    timeout = 60_000,
  ): Promise<
    {
      asset_unique_id: string;
      symbol: string;
      balance: number;
      native?: boolean;
    }[]
  > {
    return withTimeout(this.getTokenPortfolio(address, assets), timeout);
  }

  async getTokenPortfolio(
    address: string,
    assets: Asset[],
  ): Promise<
    {
      asset_unique_id: string;
      symbol: string;
      balance: number;
      native?: boolean;
    }[]
  > {
    const values = await (this.apiAt?.call?.currenciesApi?.accounts !== undefined
      ? this.getCurrenciesBalance(address, assets)
      : this.getTokenBalances(address, assets));
    const nativeBalance = await this.getNativeTokenBalance(address);
    const nativeToken = assets.find((a) => a.native);

    if (nativeToken) {
      const decMul = 10 ** nativeToken.decimals;
      values.push({
        asset_unique_id: nativeToken.unique_id,
        symbol: nativeToken.symbol,
        balance: nativeBalance / decMul,
        native: true,
      });
    } else {
      logger.warn("No native token in portfolio of " + address);
    }

    return values;
  }

  async getTokenBalances(
    address: string,
    assets: Asset[],
  ): Promise<
    {
      asset_unique_id: string;
      symbol: string;
      balance: number;
      native?: boolean;
    }[]
  > {
    function convert(balanceInfo: Record<string, any>): {
      asset_unique_id: string;
      symbol: string;
      balance: number;
      native?: boolean;
    }[] {
      const tokenBalances: {
        asset_unique_id: string;
        symbol: string;
        balance: number;
      }[] = [];
      balanceInfo.forEach(([key, val]) => {
        const tokenDescr = normalizeKeys(key.args[1].toJSON());
        const token = assets.find((t) =>
          isEqual(normalizeKeys(t.token_id), tokenDescr),
        );
        const values = val.toJSON();
        const balance =
          (Number(values.free) + Number(values.reserved)) /
          10 ** (token?.decimals || 1);
        tokenBalances.push({
          symbol: token?.symbol ?? JSON.stringify(tokenDescr),
          balance,
          asset_unique_id: token?.unique_id,
        });
      });
      return tokenBalances;
    }

    return convert(await this.apiAt.query.tokens.accounts.entries(address));
  }

  async getCurrenciesBalance(
    address: string,
    assets: Asset[],
  ): Promise<
    {
      asset_unique_id: string;
      symbol: string;
      balance: number;
      native?: boolean;
    }[]
  > {
    const balanceInfo = (await this.apiAt.call.currenciesApi.accounts(
      address,
    )) as any;
    return Object.values(balanceInfo.toJSON())
      .map((value) => {
        const token = assets.find((a) => a.token_id === value[0]);
        if (!token) {
          return;
        }
        return {
          asset_unique_id: token.unique_id,
          symbol: token.symbol,
          balance:
            (Number(BigInt(value[1].free) ?? 0n) +
              Number(BigInt(value[1].reserved) ?? 0)) /
            10 ** token.decimals,
        };
      })
      .filter((t) => !!t);
  }
}
