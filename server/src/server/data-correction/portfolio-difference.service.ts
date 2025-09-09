import { SubscanApi } from "../blockchain/substrate/api/subscan.api";
import { PolkadotApi } from "../blockchain/substrate/api/polkadot-api";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { logger } from "../logger/logger";

const POLKADOT_API_TIMEOUT = 30_000;

export interface PortfolioDifference {
  symbol: string;
  unique_id: string;
  decimals: number;
  asset_id: number;
  diff: number;
  native?: boolean;
  balanceBefore: number;
  balanceAfter: number;
}

const generateKey = (shortElements: (string | number)[], obj?: any) => {
  function fnv1aHash(str) {
    let hash = 0xcbf29ce484222325n; // 64-bit offset basis
    const prime = 0x100000001b3n; // 64-bit FNV prime

    for (let i = 0; i < str.length; i++) {
      hash ^= BigInt(str.charCodeAt(i));
      hash = (hash * prime) & 0xffffffffffffffffn; // 64-bit mask
    }

    return hash.toString(16); // hex string (base16)
  }
  return shortElements.join(",") + fnv1aHash(JSON.stringify(obj ?? {}));
};

export class PortfolioDifferenceService {
  private polkadotApi: PolkadotApi | undefined;

  constructor(private subscanApi: SubscanApi) {}

  assetsCache: Record<
    string,
    {
      asset_unique_id: string;
      symbol: string;
      balance: number;
      native?: boolean;
    }[]
  > = {};

  async fetchPortfolioDifference(
    chainInfo: { domain: string; token: string },
    address: string,
    minBlock: number,
    maxBlock: number,
  ): Promise<PortfolioDifference[]> {
    const tokenPallet = subscanChains.chains.find(
      (c) => c.domain === chainInfo.domain,
    )?.tokenPallet;
    if (tokenPallet) {
      const tokenDiff = await this.fetchPortfolioTokenDifference(
        chainInfo,
        address,
        minBlock,
        maxBlock,
      );
      return tokenDiff;
    } else {
      const assetDiff = await this.fetchPortfolioAssetDifference(
        chainInfo,
        address,
        minBlock,
        maxBlock,
      );
      return assetDiff;
    }
  }

  async fetchPortfolioAssets(
    chain: string,
    minBlock: number,
    maxBlock: number,
    address: string,
    relevantTokens: {
      unique_id: string;
      symbol: string;
      decimals: number;
      asset_id: string;
      native: boolean;
    }[],
  ) {
    const key1 = generateKey(
      [chain, address, minBlock],
      relevantTokens.map((r) => r.unique_id),
    );
    const key2 = generateKey(
      [chain, address, maxBlock],
      relevantTokens.map((r) => r.unique_id),
    );

    const fetchAssetsViaApi = async (block: number, key: string) => {
      const start = new Date();
      this.polkadotApi = this.polkadotApi ?? new PolkadotApi(chain);
      await this.polkadotApi.setApiAtWithTimeout(block, POLKADOT_API_TIMEOUT);
      const portfolio = await this.polkadotApi.getAssetPortfolioWithTimeout(
        address,
        relevantTokens,
        POLKADOT_API_TIMEOUT,
      );
      logger.debug(
        `Fetched Portfolio in ${(new Date().getTime() - start.getTime()) / 1000} seconds`,
      );
      this.assetsCache[key] = portfolio;
      return portfolio;
    };

    const portfolioAtMinBlock =
      this.assetsCache[key1] ?? (await fetchAssetsViaApi(minBlock, key1));
    const portfolioAtMaxBlock =
      this.assetsCache[key2] ?? (await fetchAssetsViaApi(maxBlock, key2));
    return { portfolioAtMinBlock, portfolioAtMaxBlock };
  }

  private async fetchPortfolios<T>(
    domain: string,
    minBlock: number,
    maxBlock: number,
    address: string,
    tokens: T[],
    getPortfolioFn: (
      api: PolkadotApi,
      address: string,
      tokens: T[],
    ) => Promise<
      {
        asset_unique_id: string;
        symbol: string;
        balance: number;
        native?: boolean;
      }[]
    >,
  ) {
    const key1 = generateKey([domain, address, minBlock], tokens);
    const key2 = generateKey([domain, address, maxBlock], tokens);

    const fetchViaApi = async (block: number, key: string) => {
      const start = new Date();
      this.polkadotApi = this.polkadotApi ?? new PolkadotApi(domain);
      await this.polkadotApi.setApiAtWithTimeout(block, POLKADOT_API_TIMEOUT);
      const portfolio = await getPortfolioFn(this.polkadotApi, address, tokens);
      logger.debug(
        `Fetched Portfolio in ${(new Date().getTime() - start.getTime()) / 1000} seconds`,
      );
      this.assetsCache[key] = portfolio;
      return portfolio;
    };

    const portfolioAtMinBlock =
      this.assetsCache[key1] ?? (await fetchViaApi(minBlock, key1));
    const portfolioAtMaxBlock =
      this.assetsCache[key2] ?? (await fetchViaApi(maxBlock, key2));

    return { portfolioAtMinBlock, portfolioAtMaxBlock };
  }

  private calculateDiffs<T extends { unique_id: string; asset_id: any }>(
    tokens: T[],
    portfolioAtMinBlock: { asset_unique_id: string; balance: number }[],
    portfolioAtMaxBlock: { asset_unique_id: string; balance: number }[],
    defaultValue: undefined | number,
  ) {
    return tokens.map((t) => {
      const balanceBefore =
        portfolioAtMinBlock.find(
          (p) =>
            p.asset_unique_id === t.unique_id ||
            p.asset_unique_id === t.asset_id,
        )?.balance ?? defaultValue;
      const balanceAfter =
        portfolioAtMaxBlock.find(
          (p) =>
            p.asset_unique_id === t.unique_id ||
            p.asset_unique_id === t.asset_id,
        )?.balance ?? defaultValue;
      return {
        ...t,
        balanceBefore,
        balanceAfter,
        diff: balanceAfter - balanceBefore,
      };
    });
  }

  async fetchPortfolioAssetDifference(
    chain: { domain: string; token: string },
    address: string,
    minBlock: number,
    maxBlock: number,
  ): Promise<PortfolioDifference[]> {
    const portfolioNow = await this.subscanApi.fetchAccountTokens(
      chain.domain,
      address,
    );
    const mergedPortfolio = [
      ...(portfolioNow.builtin ?? []),
      ...((portfolioNow.native ?? []).map((n) => ({ ...n, native: true })) ??
        []),
      ...(portfolioNow.assets ?? []),
    ];

    const relevantTokens = mergedPortfolio
      .filter((b) => b.unique_id.startsWith("standard_assets/") || b.native)
      .map((b) => ({
        unique_id: b.unique_id,
        symbol: b.symbol,
        decimals: b.decimals,
        asset_id: b.asset_id,
        native: b.native,
      }));

    if (!relevantTokens.find((t) => t.native)) {
      const nativeToken = await this.subscanApi.fetchNativeToken(chain.domain);
      relevantTokens.push({
        unique_id: chain.token,
        symbol: chain.token,
        decimals: nativeToken.token_decimals,
        asset_id: chain.token,
        native: true,
      });
    }

    const { portfolioAtMinBlock, portfolioAtMaxBlock } =
      await this.fetchPortfolios(
        chain.domain,
        minBlock,
        maxBlock,
        address,
        relevantTokens,
        (api, addr, tokens) =>
          api.getAssetPortfolioWithTimeout(addr, tokens, POLKADOT_API_TIMEOUT),
      );

    return this.calculateDiffs(
      relevantTokens,
      portfolioAtMinBlock,
      portfolioAtMaxBlock,
      undefined,
    );
  }

  async fetchPortfolioTokenDifference(
    chainInfo: { domain: string; token: string },
    address: string,
    minBlock: number,
    maxBlock: number,
  ): Promise<PortfolioDifference[]> {
    const tokens = (await this.subscanApi.scanTokens(chainInfo.domain))
      .filter((t) => t.currency_id !== chainInfo.token)
      .filter((t) => !!t.symbol);

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

    const { portfolioAtMinBlock, portfolioAtMaxBlock } =
      await this.fetchPortfolios(
        chainInfo.domain,
        minBlock,
        maxBlock,
        address,
        tokens,
        (api, addr, toks) =>
          api.getTokenPortfolioWithTimeout(addr, toks, POLKADOT_API_TIMEOUT),
      );

    return this.calculateDiffs(
      tokens,
      portfolioAtMinBlock,
      portfolioAtMaxBlock,
      0,
    );
  }

  disconnectApi() {
    if (this.polkadotApi) {
      this.polkadotApi.disconnect();
      this.polkadotApi = undefined;
    }
  }
}
