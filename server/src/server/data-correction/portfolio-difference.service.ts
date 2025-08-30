import { SubscanApi } from "../blockchain/substrate/api/subscan.api";
import { PolkadotApi } from "../blockchain/substrate/api/polkadot-api";
import { logger } from "../logger/logger";
import { Asset } from "../blockchain/substrate/model/asset";

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
  private polkadotApi: any;

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
    logger.info(
      `Enter fetchPortfolioDifference for ${chainInfo.domain} and wallet ${address}`,
    );
    switch (chainInfo.domain) {
      case "hydration":
      case "basilisk":
      case "bifrost":
      case "bofrost-kusama":
        const tokenDiff = await this.fetchPortfolioTokenDifference(
          chainInfo,
          address,
          minBlock,
          maxBlock,
        );
        logger.info(
          `Exit fetchPortfolioDifference for ${chainInfo.domain} and wallet ${address}`,
        );
        return tokenDiff;
      default:
        const assetDiff = await this.fetchPortfolioAssetDifference(
          chainInfo.domain,
          address,
          minBlock,
          maxBlock,
        );
        logger.info(
          `Exit fetchPortfolioDifference for ${chainInfo.domain} and wallet ${address}`,
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
    const key1 = generateKey([chain, address, minBlock], relevantTokens);
    const key2 = generateKey([chain, address, maxBlock], relevantTokens);

    const fetchAssetsViaApi = async (block: number, key: string) => {
      this.polkadotApi = this.polkadotApi ?? new PolkadotApi(chain);
      await this.polkadotApi.setApiAt(block);
      const portfolio = await this.polkadotApi.getAssetPortfolio(
        address,
        relevantTokens,
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

  async fetchPortfolioAssetDifference(
    chain: string,
    address: string,
    minBlock: number,
    maxBlock: number,
  ): Promise<
    {
      symbol: string;
      unique_id: string;
      decimals: number;
      asset_id: number;
      diff: number;
      balanceBefore: number;
      balanceAfter: number;
    }[]
  > {
    const portfolioNow = await this.subscanApi.fetchAccountTokens(
      chain,
      address,
    );
    const mergedPortfolio = [
      ...(portfolioNow.builtin ?? []),
      ...(portfolioNow.native.map((n) => ({
        ...n,
        native: true,
      })) ?? []),
      ...(portfolioNow.assets ?? []),
    ];
    const relevantTokens = mergedPortfolio
      .filter(
        // current limitation: only validate standard assets
        (b) => b.unique_id.startsWith("standard_assets/") || b.native,
      )
      .map((b) => ({
        unique_id: b.unique_id,
        symbol: b.symbol,
        decimals: b.decimals,
        asset_id: b.asset_id,
        native: b.native,
      }));

    const { portfolioAtMinBlock, portfolioAtMaxBlock } =
      await this.fetchPortfolioAssets(
        chain,
        minBlock,
        maxBlock,
        address,
        relevantTokens,
      );

    return relevantTokens.map((t) => {
      const valueAtMinBlock = portfolioAtMinBlock.find(
        (p) => p.asset_unique_id === t.unique_id,
      )?.balance;
      const valueAtMaxBlock = portfolioAtMaxBlock.find(
        (p) => p.asset_unique_id === t.unique_id,
      )?.balance;
      return {
        ...t,
        balanceBefore: valueAtMinBlock,
        balanceAfter: valueAtMaxBlock,
        diff: valueAtMaxBlock - valueAtMinBlock,
      };
    });
  }

  private async fetchTokenPortfolios(
    domain: string,
    minBlock: number,
    maxBlock: number,
    address: string,
    tokens: Asset[],
  ) {
    const key1 = generateKey([domain, address, minBlock]);
    const key2 = generateKey([domain, address, maxBlock]);

    const fetchAssetsViaApi = async (block: number, key: string) => {
      this.polkadotApi = this.polkadotApi ?? new PolkadotApi(domain);
      await this.polkadotApi.setApiAt(block);
      const portfolio = await this.polkadotApi.getTokenPortfolio(
        address,
        tokens,
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

  async fetchPortfolioTokenDifference(
    chainInfo: { domain: string; token: string },
    address: string,
    minBlock: number,
    maxBlock: number,
  ): Promise<
    {
      symbol: string;
      unique_id: string;
      decimals: number;
      asset_id: number;
      diff: number;
      balanceBefore: number;
      balanceAfter: number;
    }[]
  > {
    const tokens = (await this.subscanApi.scanTokens(chainInfo.domain)).filter(
      (t) => t.currency_id !== chainInfo.token,
    ); // ensure the native token is only included once.
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
      await this.fetchTokenPortfolios(
        chainInfo.domain,
        minBlock,
        maxBlock,
        address,
        tokens,
      );

    return tokens.map((t) => {
      const valueAtMinBlock =
        portfolioAtMinBlock.find(
          (p) =>
            p.asset_unique_id === t.unique_id ||
            p.asset_unique_id === t.asset_id,
        )?.balance ?? 0;
      const valueAtMaxBlock =
        portfolioAtMaxBlock.find(
          (p) =>
            p.asset_unique_id === t.unique_id ||
            p.asset_unique_id === t.asset_id,
        )?.balance ?? 0;
      return {
        ...t,
        balanceAfter: valueAtMaxBlock,
        balanceBefore: valueAtMinBlock,
        diff: valueAtMaxBlock - valueAtMinBlock,
      };
    });
  }
}
