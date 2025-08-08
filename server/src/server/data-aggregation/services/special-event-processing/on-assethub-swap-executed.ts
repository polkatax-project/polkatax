import { Asset } from "../../../blockchain/substrate/model/asset";
import { ForeignAsset } from "../../../blockchain/substrate/model/foreign-asset";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";
import { extractAddress, getPropertyValue } from "./helper";
import isEqual from "lodash.isequal";
import { toTransfer } from "./to-transfer";

export const onAssethubSwapExecuted = async (
  event: EventDetails,
  { foreignAssets, tokens }: { foreignAssets: ForeignAsset[]; tokens: Asset[] },
): Promise<EventDerivedTransfer[]> => {
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

  const amount_in =
    Number(getPropertyValue("amount_in", event)) /
    Math.pow(10, fromAsset?.decimals);
  const amount_out =
    Number(getPropertyValue("amount_out", event)) /
    Math.pow(10, toAsset?.decimals);
  return [
    toTransfer(event, from, "", amount_in, fromAsset),
    toTransfer(event, "", to, amount_out, toAsset),
  ];
};
