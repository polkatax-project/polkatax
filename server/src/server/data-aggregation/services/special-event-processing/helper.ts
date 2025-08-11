import { Asset } from "../../../blockchain/substrate/model/asset";
import { ForeignAsset } from "../../../blockchain/substrate/model/foreign-asset";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { XcmTransfer } from "../../../blockchain/substrate/model/xcm-transfer";
import { mapPublicKeyToAddress } from "../../../blockchain/substrate/util/map-public-key-to-address";
import { isEvmAddress } from "../../helper/is-evm-address";
import isEqual from "lodash.isequal";
import { getAddress } from "ethers";

export const getPropertyValue = (
  property: string | string[],
  event: EventDetails,
) => {
  if (!Array.isArray(property)) {
    property = [property];
  }
  return event.params.find((p) => property.includes(p.name))?.value;
};

export const extractAddress = (
  property: string | string[],
  event: EventDetails,
) => {
  const value = getPropertyValue(property, event);
  return mapKeyToCanonicalAddress(value);
};

export const extractAsset = (
  property: string | string[],
  event: EventDetails,
  tokens: Asset[],
) => {
  const value = getPropertyValue(property, event);
  return tokens.find(
    (t) =>
      value == t.asset_id || value === t.token_id || isEqual(value, t.asset_id),
  );
};

export const extractToken = (
  property: string | string[],
  event: EventDetails,
  tokens: Asset[],
) => {
  const value = getPropertyValue(property, event);
  return tokens.find((t) => value === t.token_id);
};

export const extractForeignAsset = (
  property: string | string[],
  event: EventDetails,
  tokens: ForeignAsset[],
) => {
  const value = getPropertyValue(property, event);
  return tokens.find(
    (t) =>
      value == t.asset_id ||
      isEqual(value, t.multi_location) ||
      isEqual(value, t.asset_id),
  );
};

export const mapKeyToCanonicalAddress = (key: string) => {
  if (isEvmAddress(key)) {
    return getAddress(key);
  }
  return mapPublicKeyToAddress(key);
};

export function findMatchingXcm(
  event: EventDetails,
  xcmList: XcmTransfer[],
): XcmTransfer {
  return xcmList.find(
    (xcm) =>
      (event.event_index && event.extrinsic_index === xcm.extrinsic_index) ||
      event.timestamp === xcm.timestamp,
  );
}
