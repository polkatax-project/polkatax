import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractAddress, findMatchingXcm, getPropertyValue } from "./helper";

export const onBalancesDeposit = async (
  event: EventDetails,
  { tokens, xcmList, label, semanticGroupId }: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const to = extractAddress("who", event);
  const token = tokens.find((t) => t.native);
  const xcm = findMatchingXcm(event, xcmList);
  return {
    event,
    to,
    rawAmount: getPropertyValue("amount", event),
    token,
    xcm,
    label: (label ?? xcm) ? "XCM transfer" : undefined,
    semanticGroupId,
  };
};
