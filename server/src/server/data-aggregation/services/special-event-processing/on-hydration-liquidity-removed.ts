import { Asset } from "../../../blockchain/substrate/model/asset";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";
import { extractAddress, extractToken, getPropertyValue } from "./helper";
import { toTransfer } from "./to-transfer";

export const onHydrationLiquidityRemoved = async (
  event: EventDetails,
  { tokens }: { tokens: Asset[] },
): Promise<EventDerivedTransfer> => {
  const owner = extractAddress("who", event);
  const asset = extractToken("pool_id", event, tokens);
  const amount =
    Number(getPropertyValue("shares", event)) / Math.pow(10, asset?.decimals);
  return toTransfer(event, owner, "", amount, asset);
};
