import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractAddress, extractToken, getPropertyValue } from "./helper";

export const onXykLiquidityAdded = async (
  event: EventDetails,
  context: EventHandlerContext,
): Promise<EventDerivedAssetMovement[]> => {
  const from = extractAddress("who", event);
  const assetA = extractToken("asset_a", event, context.tokens);
  const assetB = extractToken("asset_b", event, context.tokens);
  const amountA = getPropertyValue("amount_a", event);
  const amountB = getPropertyValue("amount_b", event);

  return [
    {
      event,
      from,
      rawAmount: amountA,
      token: assetA,
      label: "Liquidity added",
      semanticGroupId: event.event_index,
    },
    {
      event,
      from,
      rawAmount: amountB,
      token: assetB,
      label: "Liquidity added",
      semanticGroupId: event.event_index,
    },
  ];
};
