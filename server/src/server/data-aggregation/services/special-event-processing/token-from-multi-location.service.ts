import * as subscanChains from "../../../../../res/gen/subscan-chains.json";
import * as otherSubstrateChains from "../../../../../res/other-substrate-chains.json";
import { EthTokenInfoService } from "../../../blockchain/evm/service/eth.token-info.service";
import { SubscanService } from "../../../blockchain/substrate/api/subscan.service";
import { Asset } from "../../../blockchain/substrate/model/asset";
import { MultiLocation } from "../../../blockchain/substrate/model/xcm-transfer";
import { identifyTokenFromMultiLocation } from "../../../blockchain/substrate/util/identify-token-from-multi-location";

export class TokenFromMultiLocationService {
  constructor(
    private subscanService: SubscanService,
    private ethTokenInfoService: EthTokenInfoService,
  ) {}

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

  async extractTokenInfoFromMultiLocation(
    chainInfo: { token: string; domain: string },
    multiLocation: MultiLocation,
  ): Promise<{ symbol: string; decimals: number; unique_id?: string }> {
    const multiLocationToken = identifyTokenFromMultiLocation(
      chainInfo.domain,
      multiLocation,
    );
    switch (multiLocationToken.type) {
      case "ethereum_asset":
        if (!multiLocationToken.address) {
          return { symbol: "ETH", decimals: 18 };
        }
        const ethToken = await this.ethTokenInfoService.fetchTokenInfo(
          "ethereum",
          multiLocationToken.address,
        );
        if (ethToken) {
          return { symbol: ethToken.symbol, decimals: ethToken.decimals };
        }
        return { symbol: undefined, decimals: undefined };
      case "parachain_asset":
        const assets = await this.fetchAssets(chainInfo.domain);
        const parachainToken = assets.find(
          (a) =>
            a.asset_id === multiLocationToken.generalIndex ||
            a.currency_id === String(multiLocationToken.generalIndex),
        );
        if (parachainToken) {
          return {
            symbol: parachainToken.symbol,
            decimals: parachainToken.decimals,
          };
        }
        return { symbol: undefined, decimals: undefined };
      case "native":
        const decimals = await this.getDecimalsNativeToken(chainInfo.domain);
        return {
          symbol: chainInfo.token,
          decimals: decimals,
          unique_id: chainInfo.token,
        };
      default:
        return { symbol: undefined, decimals: undefined };
    }
  }
}
