import { ForeignAsset } from "../../blockchain/substrate/model/foreign-asset";
import { MultiLocation } from "../../blockchain/substrate/model/multi-location";
import isEqual from "lodash.isequal";

export const determineForeignAsset = (multiLocation: MultiLocation | string | number, tokens: ForeignAsset[]) => {
    let token = tokens.find(
    (t) =>
      isEqual(multiLocation, t.multi_location) ||
      isEqual(multiLocation, t.asset_id),
  );
  if (!token && typeof (multiLocation as MultiLocation)?.interior?.X1 === "object") {
    const assetIdAlt = {
      parents: (multiLocation as MultiLocation).parents,
      interior: { X1: [(multiLocation as MultiLocation)?.interior?.X1] },
    };
    token = tokens.find((a) => isEqual(a.multi_location, assetIdAlt));
  }
  return token;
}
