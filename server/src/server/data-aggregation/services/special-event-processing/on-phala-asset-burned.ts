import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractAddress, extractAsset, getPropertyValue } from "./helper";

export const onPhalaAssetBurned = async (
  event: EventDetails,
  { tokens }: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const from = extractAddress("owner", event);
  const token = extractAsset("asset_id", event, tokens);
  return {
    event,
    from,
    rawAmount: getPropertyValue("balance", event),
    token,
  };
};
