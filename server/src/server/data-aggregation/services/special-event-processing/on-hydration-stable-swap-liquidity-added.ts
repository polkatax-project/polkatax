import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractAddress, extractToken, getPropertyValue } from "./helper";

export const onHydrationStableSwapLiquidityAdded = async (
  event: EventDetails,
  { tokens }: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const to = extractAddress("who", event);
  const token = extractToken("pool_id", event, tokens);
  return {
    event,
    to,
    rawAmount: getPropertyValue("shares", event),
    token,
    label: "Liquidity added",
  };
};
