import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractAddress, getPropertyValue } from "./helper";

export const onCoretimePurchased = async (
  event: EventDetails,
  { tokens }: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const from = extractAddress("who", event);
  const token = tokens.find((t) => t.native);
  return {
    event,
    from,
    rawAmount: getPropertyValue("price", event),
    token,
    label: "Coretime purchase",
  };
};
