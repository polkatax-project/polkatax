import { Asset } from "../../../blockchain/substrate/model/asset";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";
import { extractAddress, getPropertyValue } from "./helper";
import { toTransfer } from "./to-transfer";

export const onReserveRepatriated = async (
  event: EventDetails,
  { tokens }: { tokens: Asset[] },
): Promise<EventDerivedTransfer> => {
  const to = extractAddress("to", event);
  const from = extractAddress("from", event);
  const tokenInfo = tokens.find((t) => t.native);
  const amount =
    Number(getPropertyValue("amount", event)) /
    Math.pow(10, tokenInfo?.decimals);
  return toTransfer(
    event,
    from,
    to,
    amount,
    tokenInfo,
    undefined,
    "Reserve repatriated",
  );
};
