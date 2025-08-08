import BigNumber from "bignumber.js";
import { Asset } from "../../../blockchain/substrate/model/asset";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";
import { extractAddress, getPropertyValue } from "./helper";
import { toTransfer } from "./to-transfer";

export const onMigratedDelegation = async (
  chainInfo: { token: string; domain: string },
  event: EventDetails,
  { tokens }: { tokens: Asset[] },
): Promise<EventDerivedTransfer> => {
  const address = extractAddress("delegator", event);
  const token = tokens.find((t) => t.symbol === chainInfo.token);
  const amount = new BigNumber(getPropertyValue("amount", event))
    .multipliedBy(Math.pow(10, -token.decimals))
    .toNumber();
  return toTransfer(event, "", address, amount, token);
};
