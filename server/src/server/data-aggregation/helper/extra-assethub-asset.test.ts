import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Asset } from "../../blockchain/substrate/model/asset";
import { ForeignAsset } from "../../blockchain/substrate/model/foreign-asset";
import { MultiLocation } from "../../blockchain/substrate/model/multi-location";

jest.mock("./determine-foreign-asset", () => ({
  determineForeignAsset: jest.fn(),
}));

import { determineForeignAsset } from "./determine-foreign-asset";
import { extractAssethubAsset } from "./extract-assethub-asset";

describe("extractAssethubAsset", () => {
  const nativeAsset: Asset = {
    id: "dot",
    symbol: "DOT",
    asset_id: "DOT",
    unique_id: "DOT",
    decimals: 10,
    native: true,
  };

  const foreignAsset: ForeignAsset = {
    id: "usdt",
    symbol: "USDT",
    unique_id: "ref/123",
    decimals: 6,
    asset_id: "usdt-1",
    multi_location: { parents: 0, interior: { X1: ["Parachain"] } },
  };

  const generalIndexAsset: Asset = {
    id: "gi",
    symbol: "GI",
    unique_id: "ref/1234",
    decimals: 12,
    native: false,
    asset_id: "42",
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns native asset when parents=1 and interior={Here:'NULL'}", () => {
    const ml: MultiLocation = { parents: 1, interior: { Here: "NULL" } };
    const result = extractAssethubAsset(ml, [nativeAsset, foreignAsset]);
    expect(result).toEqual(nativeAsset);
  });

  it("returns foreign asset when determineForeignAsset finds match", () => {
    (determineForeignAsset as jest.Mock).mockReturnValue(foreignAsset);

    const ml: MultiLocation = { parents: 0, interior: { X1: ["Parachain"] } };
    const result = extractAssethubAsset(ml, [foreignAsset]);

    expect(determineForeignAsset).toHaveBeenCalled();
    expect(result).toEqual(foreignAsset);
  });

  it("returns general index asset when interior.X2[1].GeneralIndex matches asset_id", () => {
    const ml: MultiLocation = {
      parents: 0,
      interior: { X2: [null, { GeneralIndex: "42" }] },
    };

    const result = extractAssethubAsset(ml, [generalIndexAsset]);
    expect(result).toEqual(generalIndexAsset);
  });

  it("returns general index asset when interior.X2.col1.GeneralIndex matches asset_id", () => {
    const ml: MultiLocation = {
      parents: 0,
      interior: { X2: { col1: { GeneralIndex: "42" } } },
    };

    const result = extractAssethubAsset(ml, [generalIndexAsset]);
    expect(result).toEqual(generalIndexAsset);
  });

  it("returns undefined when no asset matches", () => {
    (determineForeignAsset as jest.Mock).mockReturnValue(undefined);

    const ml: MultiLocation = { parents: 0, interior: { X1: ["NonExistent"] } };
    const result = extractAssethubAsset(ml, [nativeAsset, foreignAsset]);
    expect(result).toBeUndefined();
  });
});
