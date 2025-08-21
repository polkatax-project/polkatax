import { expect, it, jest, describe } from "@jest/globals";
import { findCoingeckoIdForNativeToken } from "./find-coingecko-id-for-native-token";

jest.mock("../../../../res/substrate-token-to-coingecko-id.json", () => ({
  tokens: [
    { token: "DOT", coingeckoId: "polkadot" },
    { token: "KSM", coingeckoId: "kusama" },
  ],
}));

jest.mock("../../../../res/gen/subscan-chains.json", () => ({
  chains: [
    { domain: "polkadot", token: "DOT" },
    { domain: "kusama", token: "KSM" },
  ],
}));

describe("findCoingeckoIdForNativeToken", () => {
  it("should return the coingeckoId for Substrate chain", () => {
    expect(findCoingeckoIdForNativeToken("polkadot")).toBe("polkadot");
    expect(findCoingeckoIdForNativeToken("kusama")).toBe("kusama");
  });

  it("should return undefined for unknown chain", () => {
    expect(findCoingeckoIdForNativeToken("nonexistent")).toBeUndefined();
  });
});
