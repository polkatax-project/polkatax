import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { extractAddress, getPropertyValue } from "./helper";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractAssethubAsset } from "../../helper/extract-assethub-asset";

export const onAssethubSwapExecuted = async (
  event: EventDetails,
  context: EventHandlerContext,
): Promise<EventDerivedAssetMovement[]> => {
  const sender = extractAddress("who", event);
  const to = extractAddress("send_to", event);
  const amountIn = getPropertyValue("amount_in", event);
  const amountOut = getPropertyValue("amount_out", event);
  const route: { col1: any; col2: string }[] = getPropertyValue("path", event);
  const movements = route
    .filter((r) => r.col2 === amountIn || r.col2 === amountOut)
    .map((entry) => {
      const token = extractAssethubAsset(entry.col1, [
        ...context.tokens,
        ...context.foreignAssets,
      ]);
      return {
        event,
        from: entry.col2 === amountIn ? sender : undefined,
        to: entry.col2 === amountOut ? to : undefined,
        rawAmount: entry.col2,
        token,
        tokenMultiLocation: entry.col1,
        label: "Swap" as const,
        semanticGroupId: event.original_event_index,
      };
    });
  return movements;
};
