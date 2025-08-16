import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import {
  extractAddress,
  extractForeignAsset,
  findMatchingXcm,
  getPropertyValue,
} from "./helper";

export const onAssethubForeignAssetsIssued = async (
  event: EventDetails,
  { foreignAssets, xcmList }: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const to = extractAddress("owner", event);
  const token = extractForeignAsset("asset_id", event, foreignAssets);
  const xcm = findMatchingXcm(event, xcmList);
  return {
    event,
    to,
    rawAmount: getPropertyValue("amount", event),
    tokenMultiLocation: event.params.find((p) => p.name === "asset_id")?.value,
    token,
    xcm,
    label: xcm ? "XCM transfer" : undefined,
  };
};
