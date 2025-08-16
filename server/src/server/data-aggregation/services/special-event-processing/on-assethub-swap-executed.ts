import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { extractAddress, getPropertyValue } from "./helper";
import isEqual from "lodash.isequal";
import { EventHandlerContext } from "./event-handler-context";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";

export const onAssethubSwapExecuted = async (
  event: EventDetails,
  { foreignAssets, tokens }: EventHandlerContext,
): Promise<EventDerivedAssetMovement[]> => {
  const from = extractAddress("who", event);
  const to = extractAddress("send_to", event);
  const route: { col1: any; col2: any }[] = getPropertyValue("path", event);
  const assets = route
    .map((r) => r.col1)
    .map((location) => {
      if (location.interior?.Here === "NULL") {
        return tokens.find((t) => t.asset_id === "DOT");
      }
      const foreign = foreignAssets.find((t) =>
        isEqual(t.multi_location, location),
      );
      if (foreign) {
        return foreign;
      }
      const findGeneralIndex = (location: any): any => {
        const stack = [location];

        while (stack.length > 0) {
          const current = stack.pop();

          if (current?.GeneralIndex) {
            return current.GeneralIndex;
          }

          if (Array.isArray(current)) {
            stack.push(...current);
          } else if (current && typeof current === "object") {
            stack.push(...Object.values(current));
          }
        }

        return undefined;
      };
      const generalIndex = findGeneralIndex(location);
      return tokens.find((t) => t.asset_id == generalIndex);
    });
  const fromAsset = assets[0];
  const toAsset = assets[assets.length - 1];

  return [
    {
      event,
      from,
      rawAmount: getPropertyValue("amount_in", event),
      token: fromAsset,
    },
    {
      event,
      to,
      rawAmount: getPropertyValue("amount_out", event),
      token: toAsset,
    },
  ];
};
