import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { extractAddress, getPropertyValue } from "./helper";
import isEqual from "lodash.isequal";
import { EventHandlerContext } from "./event-handler-context";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";

export const onBifrostRedeemedVToken = async (
  event: EventDetails,
  { tokens }: EventHandlerContext,
): Promise<EventDerivedAssetMovement> => {
  const from = extractAddress(["redeemer", "address"], event);
  const tokenId = getPropertyValue(["currency_id", "token_id"], event);
  let token = undefined;
  if (isEqual(tokenId, { Native: "BNC" })) {
    token = tokens.find((t) => isEqual(t.token_id, { VToken: "BNC" }));
  } else {
    const vTokenId = {};
    Object.keys(tokenId).forEach((property) => {
      vTokenId["V" + property] = tokenId[property];
    });
    token = tokens.find((t) => isEqual(t.token_id, vTokenId));
  }
  return {
    event,
    from,
    rawAmount: getPropertyValue(["v_currency_amount", "vtoken_amount"], event),
    token,
    label: "Liquid staking token redeemed",
  };
};
