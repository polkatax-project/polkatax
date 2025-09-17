import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractAddress, extractToken, getPropertyValue } from "./helper";

export const onHydrationOmnipoolLiquidityAdded = async (
  event: EventDetails,
  { tokens }: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const from = extractAddress("who", event);
  const token = extractToken("asset_id", event, tokens);
  return {
    event,
    from,
    rawAmount: getPropertyValue("amount", event),
    token,
    label: "Liquidity added",
    semanticGroupId: event.original_event_index,
  };
};
