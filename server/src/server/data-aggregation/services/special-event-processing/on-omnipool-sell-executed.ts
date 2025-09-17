import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractToken, getPropertyValue } from "./helper";

export const onHydrationRouterExecuted = async (
  event: EventDetails,
  context: EventHandlerContext,
): Promise<EventDerivedAssetMovement[]> => {
  const assetIn = extractToken("asset_in", event, context.tokens);
  const assetOut = extractToken("asset_out", event, context.tokens);
  const amountIn = getPropertyValue("amount_in", event);
  const amountOut = getPropertyValue("amount_out", event);

  return [
    {
      event,
      from: context.address,
      rawAmount: amountIn,
      token: assetIn,
      label: "Swap",
      semanticGroupId: event.original_event_index,
    },
    {
      event,
      to: context.address,
      rawAmount: amountOut,
      token: assetOut,
      label: "Swap",
      semanticGroupId: event.original_event_index,
    },
  ];
};
