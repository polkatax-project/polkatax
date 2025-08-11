import { EthTokenInfoService } from "../../evm/service/eth.token-info.service";
import { Asset } from "../model/asset";
import { XcmAssetTransfer } from "../model/xcm-transfer";
import * as subscanChains from "../../../../../res/gen/subscan-chains.json";
import * as otherSubstrateChains from "../../../../../res/other-substrate-chains.json";
import { SubscanService } from "../api/subscan.service";
import { getNestedValue } from "../../../../common/util/find-property-value-nested";

export class XcmTokenResolver {
  constructor(
    private subscanService: SubscanService,
    private ethTokenInfoService: EthTokenInfoService,
  ) {}

  private getSymbolNativeToken(chain: string): string | undefined {
    switch (chain) {
      case "ethereum":
        return "ETH";
      default:
        const nativeToken = subscanChains.chains.find(
          (c) => c.domain === chain,
        )?.token;
        if (nativeToken) {
          return nativeToken;
        }
        return otherSubstrateChains.chains.find((c) => c.domain === chain)
          ?.token;
    }
  }

  private async fetchAssets(chain: string): Promise<Asset[]> {
    const chainInfo = subscanChains.chains.find((c) => c.domain === chain);
    const results = (
      await Promise.all([
        this.subscanService.scanTokens(chain),
        chainInfo?.assetPallet
          ? this.subscanService.scanAssets(chain)
          : Promise.resolve(undefined),
        chainInfo?.foreignAssetsPallet
          ? this.subscanService.fetchForeignAssets(chain)
          : Promise.resolve(undefined),
      ])
    ).filter((v) => !!v);
    return results.flat();
  }

  private async getDecimalsNativeToken(chain: string): Promise<number> {
    switch (chain) {
      case "ethereum":
        return 18;
      default:
        return (await this.subscanService.fetchNativeToken(chain))
          ?.token_decimals;
    }
  }

  async determineOriginToken(
    assetTransfer: XcmAssetTransfer,
    fromChain: string,
  ): Promise<{ symbol: string; unique_id?: string; decimals?: number }> {
    /**
     * case 1: asset_id refers to an asset in the token list of the source chain
     * case 2: asset_id refers to the relay chain token symbol, e.g. "DOT"
     * case 3: asset_id refers to a different chain, e.g. "ethereum/0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9"
     * case 4: raw value refers to different chain (e.g. Ethereum)
     * case 5: no asset_id or symbol given, indicating transfer of the native token, e.g. ETH or GLMR
     * case 6: other / unkown case. Work with symbol.
     */

    // case 1
    const assetInfos: Asset[] = await this.fetchAssets(fromChain);
    const token = assetInfos.find(
      (t) => t.unique_id === assetTransfer.asset_unique_id,
    );
    if (token) {
      return token;
    }

    // case 2
    const relayChainToken = assetInfos.find(
      (t) =>
        t.symbol === assetTransfer.asset_unique_id ||
        t.symbol === "xc" + assetTransfer.asset_unique_id,
    );
    if (relayChainToken) {
      return relayChainToken;
    }

    // case 3
    if (assetTransfer?.asset_unique_id?.startsWith("ethereum/")) {
      const address = assetTransfer.asset_unique_id.split("/")[1];
      const { symbol, decimals } =
        await this.ethTokenInfoService.fetchTokenInfo(address);
      return { symbol, decimals };
    }

    // case 4
    if (
      assetTransfer.raw &&
      getNestedValue(
        assetTransfer.raw,
        "interior.X2.col0.GlobalConsensus.Ethereum",
      )
    ) {
      const address = getNestedValue(
        assetTransfer.raw,
        "interior.X2.col1.AccountKey20.key",
      );
      if (address) {
        const { symbol, decimals } =
          await this.ethTokenInfoService.fetchTokenInfo(address);
        return { symbol, decimals };
      }
    }

    // case 5
    if (!assetTransfer.symbol) {
      const nativeTokenSymbol = this.getSymbolNativeToken(fromChain);
      if (nativeTokenSymbol) {
        const decimals = await this.getDecimalsNativeToken(fromChain);
        return {
          symbol: nativeTokenSymbol,
          unique_id: nativeTokenSymbol,
          decimals,
        };
      } else {
        return undefined;
      }
    }

    // fallback for anything else
    const viaSymbol = assetInfos.filter(
      (t) => t.symbol === assetTransfer.symbol,
    );
    if (viaSymbol.length === 1) {
      return viaSymbol[0];
    }

    return { symbol: assetTransfer.symbol, unique_id: undefined };
  }
}
