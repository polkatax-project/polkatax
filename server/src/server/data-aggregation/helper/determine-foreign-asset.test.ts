import { ForeignAsset } from "../../blockchain/substrate/model/foreign-asset";
import { MultiLocation } from "../../blockchain/substrate/model/multi-location";
import { describe, expect, it } from "@jest/globals";
import { determineForeignAsset } from "./determine-foreign-asset";

describe("determineForeignAsset", () => {
  const mkForeignAsset = (overrides: Partial<ForeignAsset>): ForeignAsset => ({
    id: "token1",
    symbol: "TKN",
    unique_id: "TKN",
    decimals: 12,
    multi_location: { parents: 1, interior: { X1: ["Parachain"] } },
    asset_id: "tkn-1",
    ...overrides,
  });

  it("returns token when multiLocation matches token.multi_location", () => {
    const token = mkForeignAsset({});
    const result = determineForeignAsset(token.multi_location, [token]);
    expect(result).toEqual(token);
  });

  it("returns token when primitive multiLocation matches asset_id", () => {
    const token = mkForeignAsset({ asset_id: "DOT" });
    const result = determineForeignAsset("DOT", [token]);
    expect(result).toEqual(token);
  });

  it("converts non-array X1 into array and finds match", () => {
    const token = mkForeignAsset({
      multi_location: { parents: 1, interior: { X1: ["AccountId32"] } },
    });
    const malformed: MultiLocation = {
      parents: 1,
      interior: { X1: { key: "AccountId32" } }, // not array
    };

    const result = determineForeignAsset(malformed, [token]);
    expect(result).toEqual(token);
  });

  it("uses fallback when X1 is object and not initially matched", () => {
    const token = mkForeignAsset({
      multi_location: {
        parents: 1,
        interior: { X1: [{ Token: "AccountKey" }] },
      },
    });
    const altForm: MultiLocation = {
      parents: 1,
      interior: { X1: { Token: "AccountKey" } }, // string, should be wrapped
    };

    const result = determineForeignAsset(altForm, [token]);
    expect(result).toEqual(token);
  });

  it("returns undefined if no match found", () => {
    const token = mkForeignAsset({ asset_id: "DOT" });
    const result = determineForeignAsset(
      { parents: 0, interior: { X1: ["Other"] } },
      [token],
    );
    expect(result).toBeUndefined();
  });

  it("returns undefined if input is string/number that doesn’t match", () => {
    const token = mkForeignAsset({ asset_id: "DOT" });
    expect(determineForeignAsset("KSM", [token])).toBeUndefined();
    expect(determineForeignAsset(12345, [token])).toBeUndefined();
  });
});
