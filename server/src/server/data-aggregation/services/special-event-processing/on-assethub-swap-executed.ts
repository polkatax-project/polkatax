import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { extractAddress, getPropertyValue } from "./helper";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { Asset } from "../../../blockchain/substrate/model/asset";
import isEqual from "lodash.isequal";
import { EventHandlerContext } from "./event-handler-context";

export const onAssethubSwapExecuted = async (
  event: EventDetails,
  { foreignAssets }: EventHandlerContext,
): Promise<EventDerivedAssetMovement[]> => {
  const to = extractAddress("send_to", event);
  const amountIn = getPropertyValue("amount_in", event);
  const amountOut = getPropertyValue("amount_out", event);
  const route: { col1: any; col2: string }[] = getPropertyValue("path", event);
  const movements = route
    .filter((r) => r.col2 === amountIn || r.col2 === amountOut)
    .map((entry) => {
      const token = foreignAssets.find((a) =>
        isEqual(a.multi_location, entry.col1),
      );
      return {
        event,
        from: entry.col2 === amountIn ? to : undefined,
        to: entry.col2 === amountOut ? to : undefined,
        rawAmount: entry.col2,
        token,
        tokenMultiLocation: entry.col1,
      };
    });
  return movements;
};
