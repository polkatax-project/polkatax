import { PolkadotApi } from "../../blockchain/substrate/api/polkadot-api";
import { SubscanApi } from "../../blockchain/substrate/api/subscan.api";
import { logger } from "../../logger/logger";

const POLKADOT_API_TIMEOUT = 30_000;

export interface PortfolioEntry {
  asset_unique_id: string;
  balance: number;
}

export class PortfolioService {
  private polkadotApi: PolkadotApi | undefined;

  constructor(private subscanApi: SubscanApi) {}

  async fetchPortfolioByType<T>(
    domain: string,
    block: number,
    address: string,
    tokens: T[],
    kind: "tokens" | "assets",
  ): Promise<PortfolioEntry[]> {
    const fetchPortfolioFn = (api, addr, tokens) =>
      kind === "assets"
        ? api.getAssetPortfolioWithTimeout(addr, tokens, POLKADOT_API_TIMEOUT)
        : api.getTokenPortfolioWithTimeout(addr, tokens, POLKADOT_API_TIMEOUT);
    const start = new Date();
    this.polkadotApi = this.polkadotApi ?? new PolkadotApi(domain);
    await this.polkadotApi.setApiAtWithTimeout(block, POLKADOT_API_TIMEOUT);
    const portfolio = await fetchPortfolioFn(this.polkadotApi, address, tokens);
    logger.debug(
      `Fetched Portfolio in ${(new Date().getTime() - start.getTime()) / 1000} seconds`,
    );
    return portfolio;
  }

  disconnectApi() {
    if (this.polkadotApi) {
      this.polkadotApi.disconnect();
      this.polkadotApi = undefined;
    }
  }

  async fetchAssetsInPortfolio(
    chainInfo: { domain: string; token: string },
    address: string,
  ): Promise<
    {
      unique_id: string;
      symbol: string;
      decimals: number;
      asset_id: number;
      native: true;
    }[]
  > {
    const portfolioNow = await this.subscanApi.fetchAccountTokens(
      chainInfo.domain,
      address,
    );
    const mergedPortfolio = [
      ...(portfolioNow.builtin ?? []),
      ...((portfolioNow.native ?? []).map((n) => ({ ...n, native: true })) ??
        []),
      ...(portfolioNow.assets ?? []),
    ];

    const tokens = mergedPortfolio
      .filter((b) => b.unique_id.startsWith("standard_assets/") || b.native)
      .map((b) => ({
        unique_id: b.unique_id,
        symbol: b.symbol,
        decimals: b.decimals,
        asset_id: b.asset_id,
        native: b.native,
      }));

    if (!tokens.find((t) => t.native)) {
      const nativeToken = await this.subscanApi.fetchNativeToken(
        chainInfo.domain,
      );
      tokens.push({
        unique_id: chainInfo.token,
        symbol: chainInfo.token,
        decimals: nativeToken.token_decimals,
        asset_id: chainInfo.token,
        native: true,
      });
    }
    return tokens;
  }

  async fetchTokenPortfolio(
    chainInfo: { domain: string; token: string },
    address: string,
    block: number,
  ): Promise<PortfolioEntry[]> {
    const tokens = (await this.subscanApi.scanTokens(chainInfo.domain))
      .filter((t) => t.currency_id !== chainInfo.token)
      .filter((t) => !!t.symbol)
      .filter((t) => !t.symbol.startsWith("vsBOND-DOT-")); // balance is always zero for these tokens!

    const nativeToken = await this.subscanApi.fetchNativeToken(
      chainInfo.domain,
    );

    tokens.push({
      id: chainInfo.token,
      decimals: nativeToken.token_decimals,
      symbol: chainInfo.token,
      unique_id: chainInfo.token,
      asset_id: chainInfo.token,
      currency_id: chainInfo.token,
      native: true,
    });

    return this.fetchPortfolioByType(
      chainInfo.domain,
      block,
      address,
      tokens,
      "tokens",
    );
  }
}
