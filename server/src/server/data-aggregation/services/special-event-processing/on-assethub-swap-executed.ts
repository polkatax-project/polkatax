import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { extractAddress, getPropertyValue } from "./helper";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import isEqual from "lodash.isequal";
import { EventHandlerContext } from "./event-handler-context";
import { MultiLocation } from "../../../blockchain/substrate/model/multi-location";
import { determineForeignAsset } from "../../helper/determine-foreign-asset";

const extractAsset = (
  multiLocation: MultiLocation,
  context: EventHandlerContext,
) => {
  if (
    multiLocation.parents === 1 &&
    isEqual(multiLocation.interior, { Here: "NULL" })
  ) {
    return context.tokens.find((t) => t.native);
  }
  const foreignAsset = determineForeignAsset(
    multiLocation,
    context.foreignAssets,
  );
  if (foreignAsset) {
    return foreignAsset;
  }
  if (multiLocation.interior?.X2?.[1].GeneralIndex) {
    const token = context.tokens.find(
      (a) => a.asset_id == multiLocation.interior?.X2?.[1].GeneralIndex,
    );
    return token;
  }
};

export const onAssethubSwapExecuted = async (
  event: EventDetails,
  context: EventHandlerContext,
): Promise<EventDerivedAssetMovement[]> => {
  const to = extractAddress("send_to", event);
  const amountIn = getPropertyValue("amount_in", event);
  const amountOut = getPropertyValue("amount_out", event);
  const route: { col1: any; col2: string }[] = getPropertyValue("path", event);
  const movements = route
    .filter((r) => r.col2 === amountIn || r.col2 === amountOut)
    .map((entry) => {
      const token = extractAsset(entry.col1, context);
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
