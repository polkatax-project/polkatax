import * as substrateToCoingeckoId from "../../../../res/substrate-token-to-coingecko-id.json";
import * as coingeckoTokens from "../../../../res/coingecko-tokens.json";

export const lookupCoingeckoId = (symbol: string): string => {
  const coingeckoIdFromNativeToken = substrateToCoingeckoId.tokens.find(
    (t) => t.token.toUpperCase() === symbol.toUpperCase(),
  );
  if (coingeckoIdFromNativeToken) {
    return coingeckoIdFromNativeToken.coingeckoId;
  } else {
    return coingeckoTokens.tokens.find(
      (t) => t.symbol.toLowerCase() === symbol.toLowerCase(),
    )?.id;
  }
};
