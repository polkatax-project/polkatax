import isEqual from "lodash.isequal";
import { Asset } from "../../server/blockchain/substrate/model/asset";

export function bifrostParseKind(jsonString): string | number {
  if (typeof jsonString === "string") {
    const match = jsonString.match(/"__kind"\s*:\s*"([^"]+)"/);
    if (match) {
      return match[1]; // The captured value (e.g. "BNC")
    }
  }
  return isNaN(Number(jsonString)) ? jsonString : Number(jsonString); // No match → return original number/string
}

export const parseBifrostToken = (
  currencyType: string,
  currencyValue: any,
  tokens: Asset[],
) => {
  const parsedCurrencyValue = bifrostParseKind(currencyValue);
  const combinedTokenId = { [currencyType]: parsedCurrencyValue };
  return tokens.find(
    (t) =>
      (t.unique_id === "BNC" && parsedCurrencyValue === "BNC") ||
      isEqual(t.token_id, combinedTokenId),
  );
};
