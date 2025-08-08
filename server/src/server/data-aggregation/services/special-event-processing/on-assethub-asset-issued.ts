import { Asset } from "../../../blockchain/substrate/model/asset";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { XcmTransfer } from "../../../blockchain/substrate/model/xcm-transfer";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";
import {
  extractAddress,
  extractAsset,
  findMatchingXcm,
  getPropertyValue,
} from "./helper";
import { toTransfer } from "./to-transfer";

export const onAssethubAssetsIssued = async (
  event: EventDetails,
  { tokens, xcmList }: { tokens: Asset[]; xcmList: XcmTransfer[] },
): Promise<EventDerivedTransfer> => {
  const owner = extractAddress("owner", event);
  const asset = extractAsset("asset_id", event, tokens);
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
