import { parseBifrostToken } from "../../../../common/util/parse-bifrost-token";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractAddress, getPropertyValue } from "./helper";

export const onBifrostRedeemSuccess = async (
  event: EventDetails,
  { tokens }: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const to = extractAddress(["redeemer", "to"], event);
  const currencyValue = getPropertyValue(["currency_id", "token_id"], event);
  const token = parseBifrostToken(
    Object.keys(currencyValue)[0],
    Object.values(currencyValue)[0],
    tokens,
  );

  return {
    event,
    to,
    rawAmount: getPropertyValue("currency_amount", event),
    token,
    semanticGroupId: event.event_index,
    label: "Liquid staking token redeem success",
  };
};
