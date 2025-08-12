import { Asset } from "../../../blockchain/substrate/model/asset";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";
import { extractAddress, getPropertyValue } from "./helper";
import { toTransfer } from "./to-transfer";

export const onCoretimePurchased = async (
  event: EventDetails,
  { tokens }: { tokens: Asset[] },
): Promise<EventDerivedTransfer> => {
  const address = extractAddress("who", event);
  const tokenInfo = tokens.find((t) => t.native);
  const amount =
    Number(getPropertyValue("price", event)) /
    Math.pow(10, tokenInfo?.decimals);
  return toTransfer(
    event,
    address,
    "",
    amount,
    tokenInfo,
    undefined,
    "Coretime purchase",
  );
};
