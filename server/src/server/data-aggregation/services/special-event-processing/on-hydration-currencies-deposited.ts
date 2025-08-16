import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import {
  extractAddress,
  extractToken,
  findMatchingXcm,
  getPropertyValue,
} from "./helper";

export const onHydrationCurrenciesDeposited = async (
  event: EventDetails,
  { tokens, xcmList }: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const to = extractAddress("who", event);
  const token = extractToken("currency_id", event, tokens);
  const xcm = findMatchingXcm(event, xcmList);

  return {
    event,
    to,
    rawAmount: getPropertyValue("amount", event),
    token,
    xcm,
    label: xcm ? "XCM transfer" : undefined,
  };
};
