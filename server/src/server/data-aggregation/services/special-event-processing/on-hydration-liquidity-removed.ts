import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractAddress, extractToken, getPropertyValue } from "./helper";

export const onHydrationLiquidityRemoved = async (
  event: EventDetails,
  { tokens }: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const from = extractAddress("who", event);
  const token = extractToken("pool_id", event, tokens);
  return {
    event,
    from,
    rawAmount: getPropertyValue("shares", event),
    token,
  };
};
