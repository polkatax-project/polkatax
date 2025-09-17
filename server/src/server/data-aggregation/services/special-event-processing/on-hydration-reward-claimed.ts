import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractAddress, extractToken, getPropertyValue } from "./helper";

export const onHydrationRewardClaimed = async (
  event: EventDetails,
  { tokens }: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const to = extractAddress("who", event);
  const token = extractToken("reward_currency", event, tokens);
  return {
    event,
    to,
    rawAmount: getPropertyValue("claimed", event),
    token,
    label: "Reward",
    semanticGroupId: event.original_event_index,
  };
};
