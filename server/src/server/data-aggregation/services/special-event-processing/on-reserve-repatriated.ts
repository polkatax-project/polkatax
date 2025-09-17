import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractAddress, getPropertyValue } from "./helper";

export const onReserveRepatriated = async (
  event: EventDetails,
  { tokens }: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const to = extractAddress("to", event);
  const from = extractAddress("from", event);
  const token = tokens.find((t) => t.native);
  return {
    event,
    to,
    from,
    rawAmount: getPropertyValue("amount", event),
    token,
    semanticGroupId: event.original_event_index,
  };
};
