import { SubscanService } from "../../../blockchain/substrate/api/subscan.service";
import { Asset } from "../../../blockchain/substrate/model/asset";
import { ForeignAsset } from "../../../blockchain/substrate/model/foreign-asset";
import { AssetInfos } from "./asset-infos";

export const fetchTokens = async (
  chainInfo: {
    token: string;
    domain: string;
  },
  subscanService: SubscanService,
): Promise<AssetInfos> => {
  const token = await subscanService.fetchNativeToken(chainInfo.domain);
  let data: {
    tokens: Asset[];
    foreignAssets: ForeignAsset[];
  } = {
    tokens: [],
    foreignAssets: [],
  };
  switch (chainInfo.domain) {
    case "assethub-polkadot":
    case "assethub-kusama":
      const foreignAssets = await subscanService.fetchForeignAssets(
        chainInfo.domain,
      );
      const tokens = await subscanService.scanAssets(chainInfo.domain);
      tokens.push({
        id: chainInfo.token,
        symbol: chainInfo.token,
        decimals: token.token_decimals,
        native: true,
        unique_id: chainInfo.token,
        asset_id: chainInfo.token,
      });
      data = { foreignAssets, tokens };
      break;
    case "peaq":
    case "manta":
    case "phala":
      data.tokens = await subscanService.scanAssets(chainInfo.domain);
      data.tokens.push({
        id: chainInfo.token,
        symbol: chainInfo.token,
        decimals: token.token_decimals,
        native: true,
        unique_id: chainInfo.token,
        asset_id: chainInfo.token,
      });
      break;
    case "bifrost":
    case "bifrost-kusama":
    case "hydration":
    case "basilisk":
    case "acala":
    case "astar":
    case "mythos":
    case "energywebx":
    case "unique":
    case "spiritnet":
      data.tokens = await subscanService.scanTokens(chainInfo.domain);
      data.tokens.push({
        id: chainInfo.token,
        name: chainInfo.token,
        decimals: token.token_decimals,
        symbol: chainInfo.token,
        asset_id: { Native: chainInfo.token },
        unique_id: chainInfo.token,
        currency_id: chainInfo.token,
        native: true,
      });
      break;
    default:
      data.tokens.push({
        id: chainInfo.token,
        name: chainInfo.token,
        decimals: token.token_decimals,
        symbol: chainInfo.token,
        asset_id: { Native: chainInfo.token },
        unique_id: chainInfo.token,
        currency_id: chainInfo.token,
        native: true,
      });
  }
  return data;
};
