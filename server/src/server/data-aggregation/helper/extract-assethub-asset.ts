import { MultiLocation } from "../../blockchain/substrate/model/multi-location";
import isEqual from "lodash.isequal";
import { determineForeignAsset } from "./determine-foreign-asset";
import { Asset } from "../../blockchain/substrate/model/asset";
import { ForeignAsset } from "../../blockchain/substrate/model/foreign-asset";

export const extractAssethubAsset = (
  multiLocation: MultiLocation,
  assets: Asset[],
) => {
  if (
    multiLocation.parents === 1 &&
    isEqual(multiLocation.interior, { Here: "NULL" })
  ) {
    return assets.find((t) => t.native);
  }
  const foreignAsset = determineForeignAsset(
    multiLocation,
    assets.filter((a) => !!a.multi_location) as ForeignAsset[],
  );
  if (foreignAsset) {
    return foreignAsset;
  }
  const generalIndex =
    multiLocation.interior?.X2?.[1]?.GeneralIndex ||
    multiLocation.interior?.X2?.col1?.GeneralIndex;
  if (generalIndex) {
    const token = assets.find((a) => a.asset_id == generalIndex);
    return token;
  }
};
