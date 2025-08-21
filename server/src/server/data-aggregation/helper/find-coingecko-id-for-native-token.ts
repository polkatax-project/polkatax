import * as substrateTokenToCoingeckoId from "../../../../res/substrate-token-to-coingecko-id.json";
import * as subscanChains from "../../../../res/gen/subscan-chains.json";

export const findCoingeckoIdForNativeToken = (
  chainName: string,
): string | undefined => {
  const chainInfo = subscanChains.chains.find(
    (c) => c.domain === chainName,
  ) || { token: "" };
  return substrateTokenToCoingeckoId.tokens.find(
    (t) => t.token.toUpperCase() === chainInfo.token.toUpperCase(),
  )?.coingeckoId;
};
