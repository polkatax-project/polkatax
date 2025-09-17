import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { extractAddress, getPropertyValue } from "./helper";

export const onHydrationStableSwapLiquidityAdded = async (
  event: EventDetails,
  { tokens }: EventHandlerContext,
): Promise<EventDerivedAssetMovement[]> => {
  const from = extractAddress("who", event);
  const assets = getPropertyValue("assets", event);
  return assets.map((asset) => {
    return {
      event,
      from,
      rawAmount: asset.amount,
      token: tokens.find((t) => asset.asset_id === t.token_id),
      label: "Liquidity added",
      semanticGroupId: event.original_event_index,
    };
  });
};
