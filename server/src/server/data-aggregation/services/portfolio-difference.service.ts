import { SubscanApi } from "../../blockchain/substrate/api/subscan.api";
import { PolkadotApi } from "../../blockchain/substrate/api/polkadot-api";
import { logger } from "../../logger/logger";

export class PortfolioDifferenceService {
  constructor(private subscanApi: SubscanApi) {}

  async fetchPortfolioDifference(
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
      native?: boolean;
    }[]
  > {
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
          `Enter fetchPortfolioDifference for ${chainInfo.domain} and wallet ${address}`,
        );
        return assetDiff;
    }
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
    const polkadotApi = new PolkadotApi(chain);
    await polkadotApi.setApiAt(minBlock);
    const portfolioAtMinBlock = await polkadotApi.getAssetPortfolio(
      address,
      relevantTokens,
    );
    await polkadotApi.setApiAt(maxBlock);
    const portfolioAtMaxBlock = await polkadotApi.getAssetPortfolio(
      address,
      relevantTokens,
    );
    await polkadotApi.disconnect();

    return relevantTokens.map((t) => {
      const valueAtMinBlock = portfolioAtMinBlock.find(
        (p) => p.asset_unique_id === t.unique_id,
      )?.balance;
      const vlaueAtMaxBlock = portfolioAtMaxBlock.find(
        (p) => p.asset_unique_id === t.unique_id,
      )?.balance;
      return {
        ...t,
        diff: vlaueAtMaxBlock - valueAtMinBlock,
      };
    });
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

    const polkadotApi = new PolkadotApi(chainInfo.domain);
    await polkadotApi.setApiAt(minBlock);
    const portfolioAtMinBlock = await polkadotApi.getTokenPortfolio(
      address,
      tokens,
    );
    await polkadotApi.setApiAt(maxBlock);
    const portfolioAtMaxBlock = await polkadotApi.getTokenPortfolio(
      address,
      tokens,
    );
    await polkadotApi.disconnect();

    return tokens.map((t) => {
      const valueAtMinBlock =
        portfolioAtMinBlock.find(
          (p) =>
            p.asset_unique_id === t.unique_id ||
            p.asset_unique_id === t.asset_id,
        )?.balance ?? 0;
      const vlaueAtMaxBlock =
        portfolioAtMaxBlock.find(
          (p) =>
            p.asset_unique_id === t.unique_id ||
            p.asset_unique_id === t.asset_id,
        )?.balance ?? 0;
      return {
        ...t,
        diff: vlaueAtMaxBlock - valueAtMinBlock,
      };
    });
  }
}
