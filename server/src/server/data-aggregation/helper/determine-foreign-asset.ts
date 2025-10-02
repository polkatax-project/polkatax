import { ForeignAsset } from "../../blockchain/substrate/model/foreign-asset";
import { MultiLocation } from "../../blockchain/substrate/model/multi-location";
import isEqual from "lodash.isequal";

const convertToCanonicalFormat = (
  multiLocation: MultiLocation | string | number,
) => {
  if (!multiLocation || typeof multiLocation !== "object") {
    return;
  }
  for (let key of ["X1", "X2", "X3"]) {
    if (
      multiLocation?.interior?.[key] &&
      !Array.isArray(multiLocation?.interior?.[key])
    ) {
      multiLocation.interior[key] = Object.values(multiLocation.interior[key]);
    }
  }
};

export const determineForeignAsset = (
  multiLocation: MultiLocation | string | number,
  tokens: ForeignAsset[],
) => {
  const original = JSON.parse(JSON.stringify(multiLocation));
  convertToCanonicalFormat(multiLocation);
  let token = tokens.find(
    (t) =>
      isEqual(multiLocation, t.multi_location) ||
      isEqual(multiLocation, t.asset_id),
  );
  if (
    !token &&
    typeof (multiLocation as MultiLocation)?.interior?.X1 === "object"
  ) {
    const assetIdAlt = {
      parents: (original as MultiLocation).parents,
      interior: { X1: [(original as MultiLocation)?.interior?.X1] },
    };
    token = tokens.find((a) => isEqual(a.multi_location, assetIdAlt));
  }
  return token;
};
