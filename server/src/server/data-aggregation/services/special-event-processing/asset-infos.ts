import { Asset } from "../../../blockchain/substrate/model/asset";
import { ForeignAsset } from "../../../blockchain/substrate/model/foreign-asset";

export interface AssetInfos {
  tokens: Asset[];
  foreignAssets: ForeignAsset[];
}
