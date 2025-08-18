import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { extractAddress, getPropertyValue } from "./helper";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";

export const onAssethubSwapExecuted = async (
  event: EventDetails,
): Promise<EventDerivedAssetMovement[]> => {
  const who = extractAddress("who", event);
  const to = extractAddress("send_to", event);
  const amountIn = getPropertyValue("amount_in", event);
  const amountOut = getPropertyValue("amount_out", event);
  const route: { col1: any; col2: string }[] = getPropertyValue("path", event);
  return route
    .filter((r) => {
      r.col2 === amountIn || r.col2 === amountOut;
    })
    .map((entry) => ({
      event,
      from: entry.col2 === amountIn ? to : undefined,
      to: entry.col2 === amountOut ? to : undefined,
      rawAmount: entry.col2,
      tokenMultiLocation: entry.col1,
    }));
};
