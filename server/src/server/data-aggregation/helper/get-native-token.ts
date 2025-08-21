import * as subscanChains from "../../../../res/gen/subscan-chains.json";

export const getNativeToken = (chainName: string): string => {
  {
    return subscanChains.chains.find((s) => s.domain === chainName)?.token;
  }
};
