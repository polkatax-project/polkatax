import { SubscanApi } from "../blockchain/substrate/api/subscan.api";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { PortfolioService } from "../data-aggregation/services/portfolio.service";

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
  constructor(
    private subscanApi: SubscanApi,
    private portfolioService: PortfolioService,
  ) {}

  assetsCache: Record<
    string,
    {
      asset_unique_id: string;
      balance: number;
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
    const relevantTokens = await this.portfolioService.fetchAssetsInPortfolio(
      chain,
      address,
    );

    const minKey = generateKey(
      [chain.domain, address, minBlock],
      relevantTokens,
    );
    const portfolioAtMinBlock =
      this.assetsCache[minKey] ??
      (await this.portfolioService.fetchPortfolioByType(
        chain.domain,
        minBlock,
        address,
        relevantTokens,
        "assets",
      ));
    this.assetsCache[minKey] = portfolioAtMinBlock;

    const maxKey = generateKey(
      [chain.domain, address, maxBlock],
      relevantTokens,
    );
    const portfolioAtMaxBlock =
      this.assetsCache[maxKey] ??
      (await this.portfolioService.fetchPortfolioByType(
        chain.domain,
        maxBlock,
        address,
        relevantTokens,
        "assets",
      ));
    this.assetsCache[minKey] = portfolioAtMinBlock;

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

    const minKey = generateKey([chainInfo.domain, address, minBlock]);
    const portfolioAtMinBlock =
      this.assetsCache[minKey] ??
      (await this.portfolioService.fetchTokenPortfolio(
        chainInfo,
        address,
        minBlock,
      ));
    this.assetsCache[minKey] = portfolioAtMinBlock;

    const maxKey = generateKey([chainInfo.domain, address, maxBlock]);
    const portfolioAtMaxBlock =
      this.assetsCache[maxKey] ??
      (await this.portfolioService.fetchTokenPortfolio(
        chainInfo,
        address,
        maxBlock,
      ));
    this.assetsCache[maxKey] = portfolioAtMaxBlock;

    return this.calculateDiffs(
      tokens,
      portfolioAtMinBlock,
      portfolioAtMaxBlock,
      0,
    );
  }

  disconnectApi() {
    this.portfolioService.disconnectApi();
  }
}
