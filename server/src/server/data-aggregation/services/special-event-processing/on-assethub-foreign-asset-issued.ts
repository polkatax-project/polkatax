import { ForeignAsset } from "../../../blockchain/substrate/model/foreign-asset";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { XcmTransfer } from "../../../blockchain/substrate/model/xcm-transfer";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";
import {
  extractAddress,
  extractForeignAsset,
  findMatchingXcm,
  getPropertyValue,
} from "./helper";
import { toTransfer } from "./to-transfer";

export const onAssethubForeignAssetsIssued = async (
  event: EventDetails,
  {
    foreignAssets,
    xcmList,
  }: { foreignAssets: ForeignAsset[]; xcmList: XcmTransfer[] },
): Promise<EventDerivedTransfer> => {
  const owner = extractAddress("owner", event);
  const asset = extractForeignAsset("asset_id", event, foreignAssets);
  const amount =
    Number(getPropertyValue("amount", event)) / Math.pow(10, asset?.decimals);
  return toTransfer(
    event,
    "",
    owner,
    amount,
    asset,
    findMatchingXcm(event, xcmList),
  );
};
