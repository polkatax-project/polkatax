import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { extractAddress, getPropertyValue } from "./helper";
import { EventHandlerContext } from "./event-handler-context";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";

export const onMigratedDelegation = async (
  event: EventDetails,
  { tokens, chainInfo }: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const to = extractAddress("delegator", event);
  const token = tokens.find((t) => t.symbol === chainInfo.token);
  return {
    event,
    to,
    rawAmount: getPropertyValue("amount", event),
    token,
    label: "Migrated delegation",
  };
};
