import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractAddress, extractToken, getPropertyValue } from "./helper";

export const onAssetRegistryExistentialDepositPaid = async (
  event: EventDetails,
  context: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const from = extractAddress("who", event);
  const token = extractToken("fee_asset", event, context.tokens);
  const rawAmount = getPropertyValue("amount", event);

  return {
    event,
    from,
    rawAmount,
    token,
    label: "Existential deposit paid",
    semanticGroupId: event.event_index,
  };
};
