import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractAddress, extractToken, getPropertyValue } from "./helper";

export const onHydrationXykRewardClaimed = async (
  event: EventDetails,
  { tokens }: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const from = extractAddress("who", event);
  const token = extractToken("reward_currency", event, tokens);
  return {
    event,
    from,
    rawAmount: getPropertyValue("claimed", event),
    token,
    label: "Reward",
  };
};
