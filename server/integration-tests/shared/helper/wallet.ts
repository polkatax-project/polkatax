import { createDIContainer } from "../../../src/server/di-container";
import { getApiAt, getNativeTokenBalance } from "./get-balances-at";
import dotenv from "dotenv";
dotenv.config({ path: __dirname + "/../.env" });
import { SubscanApi } from "../../../src/server/blockchain/substrate/api/subscan.api";

export interface Portfolio {
  block: number;
  values: {
    asset_unique_id: string;
    symbol: string;
    balance: number;
    free?: number;
    reserved?: number;
    frozen?: number;
  }[];
}

export class Wallet {
  /**
   * For chains which store their wallet token balances under "assets" pallet
   */
  async getAssetBalances(
    chain: string,
    nativeToken: string,
    address: string,
    block: number,
    tokens: {
      symbol: string;
      decimals: number;
      asset_unique_id?: string;
      asset_id?: number;
    }[],
  ): Promise<Portfolio> {
    const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi");
    const nativeTokenInfo = await subscanApi.fetchNativeToken(chain);
    const apiAt = await getApiAt(block);
    const tokenBalances: {
      asset_unique_id: string;
      symbol: string;
      balance: number;
    }[] = [];
    for (let token of tokens) {
      if (token.symbol === nativeToken) {
        tokenBalances.push({
          asset_unique_id: nativeToken,
          symbol: nativeToken,
          balance:
            (await getNativeTokenBalance(apiAt, address)).nativeBalance /
            Math.pow(10, nativeTokenInfo.token_decimals),
        });
      } else {
        const balanceInfo: any = await apiAt.query.assets.account(
          token.asset_id ?? token.asset_unique_id,
          address,
        );
        tokenBalances.push({
          asset_unique_id: token.asset_unique_id ?? String(token.asset_id),
          symbol: token.symbol,
          balance:
            Number(balanceInfo.toJSON()?.balance ?? 0) /
            Math.pow(10, token.decimals),
        });
      }
    }
    return { block, values: tokenBalances };
  }

  async fetchNativeTokenBalances(
    chain: string,
    nativeToken: string,
    address: string,
    blocks: number[],
  ): Promise<Portfolio[]> {
    const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi");
    const nativeTokenInfo = await subscanApi.fetchNativeToken(chain);
    const portfolios: Portfolio[] = [];
    for (let block of blocks) {
      const apiAt = await getApiAt(block);
      const portfolio: Portfolio = {
        block,
        values: [
          {
            asset_unique_id: nativeToken,
            symbol: nativeToken,
            balance:
              (await getNativeTokenBalance(apiAt, address)).nativeBalance /
              Math.pow(10, nativeTokenInfo.token_decimals),
          },
        ],
      };
      portfolios.push(portfolio);
    }
    return portfolios;
  }

  /**
   * For chains which store their wallet token balances under "tokens" pallet
   */
  async fetchTokenBalances(
    chain: string,
    nativeToken: string,
    address: string,
    blocks: number[],
  ): Promise<Portfolio[]> {
    try {
      const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi");
      const tokens = await subscanApi.scanTokens(chain);
      const nativeTokenInfo = await subscanApi.fetchNativeToken(chain);

      function capitalizeFirst(str) {
        if (!str) return "";
        return str[0].toUpperCase() + str.slice(1);
      }

      function isSameToken(obj: any, target: any) {
        return typeof obj !== "object"
          ? obj == target
          : Object.entries(target).every(
              ([key, value]) =>
                (obj[key] ??
                  obj[key.replace("vs", "VS")] ??
                  obj[key.toUpperCase()] ??
                  obj[capitalizeFirst(key)]) == value,
            );
      }

      function convert(balanceInfo: Record<string, any>): {
        asset_unique_id: string;
        symbol: string;
        balance: number;
        free: number;
        frozen: number;
        reserved: number;
      }[] {
        const tokenBalances: {
          asset_unique_id: string;
          symbol: string;
          balance: number;
          free: number;
          frozen: number;
          reserved: number;
        }[] = [];
        balanceInfo.forEach(([key, val]) => {
          const tokenDescr = key.args[1].toJSON();
          const token = tokens.find((t) => isSameToken(t.token_id, tokenDescr));
          const values = val.toJSON();
          const balance =
            (Number(values.free) +
              Number(values.frozen) +
              Number(values.reserved)) /
            Math.pow(10, token?.decimals || 1);
          tokenBalances.push({
            symbol: token?.symbol ?? JSON.stringify(tokenDescr),
            balance,
            free: Number(values.free) / Math.pow(10, token?.decimals || 1),
            frozen: Number(values.frozen) / Math.pow(10, token?.decimals || 1),
            reserved:
              Number(values.reserved) / Math.pow(10, token?.decimals || 1),
            asset_unique_id: token?.unique_id,
          });
        });
        return tokenBalances;
      }
      const portfolios: Portfolio[] = [];
      for (let block of blocks) {
        const apiAt = await getApiAt(block);
        const portfolio: Portfolio = {
          values: convert(await apiAt.query.tokens.accounts.entries(address)),
          block,
        };
        const { nativeBalance, free, frozen, reserved } =
          await getNativeTokenBalance(apiAt, address);
        const decMul = Math.pow(10, nativeTokenInfo.token_decimals);
        portfolio.values.push({
          asset_unique_id: nativeToken,
          symbol: nativeToken,
          balance: nativeBalance / decMul,
          free: free / decMul,
          frozen: frozen / decMul,
          reserved: reserved / decMul,
        });
        portfolios.push(portfolio);
      }
      return portfolios;
    } catch (error) {
      console.error(error);
      return [];
    }
  }
}
