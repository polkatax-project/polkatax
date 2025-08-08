import BigNumber from "bignumber.js";
import { Asset } from "../../../blockchain/substrate/model/asset";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";
import { extractAddress, getPropertyValue } from "./helper";
import { toTransfer } from "./to-transfer";
import isEqual from "lodash.isequal";

export const onBifrostMintedVToken = async (
  event: EventDetails,
  { tokens }: { tokens: Asset[] },
): Promise<EventDerivedTransfer> => {
  const address = extractAddress(["minter", "address", "rebonder"], event);
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
  const amount = new BigNumber(
    getPropertyValue(["v_currency_amount", "vtoken_amount"], event),
  )
    .multipliedBy(Math.pow(10, -token.decimals))
    .toNumber();
  return toTransfer(event, "", address, amount, token);
};
