import { describe, expect, it } from "@jest/globals";
import * as subscanChains from "../../../../../res/gen/subscan-chains.json";
import {
  identifyTokenFromMultiLocation,
  isMultiLocation,
} from "./identify-token-from-multi-location";

// --- helpers ---
const polkadotRelay = subscanChains.chains.find(
  (c) => c.domain === "polkadot",
)?.relay;

describe("isMultiLocation", () => {
  it("returns true for valid MultiLocation object", () => {
    const ml = { parents: 0, interior: {} };
    expect(isMultiLocation(ml)).toBe(true);
  });

  it("returns false for non-MultiLocation object", () => {
    expect(isMultiLocation({})).toBe(false);
    expect(isMultiLocation({ parents: 0 })).toBe(false);
  });
});

describe("identifyTokenFromMultiLocation", () => {
  it("resolves Ethereum native (ETH) via GlobalConsensus + Here", () => {
    const ml = {
      parents: 0,
      interior: { X1: { GlobalConsensus: { Ethereum: {} } } },
    };
    const token = identifyTokenFromMultiLocation("polkadot", ml as any);
    expect(token).toEqual({ type: "ethereum_asset", chain: "Ethereum" });
  });

  it("resolves Ethereum ERC20 by AccountKey20", () => {
    const ml = {
      parents: 0,
      interior: {
        X2: [
          { GlobalConsensus: { Ethereum: {} } },
          { AccountKey20: { key: "0xdeadbeef" } },
        ],
      },
    };
    const token = identifyTokenFromMultiLocation("polkadot", ml as any);
    expect(token).toEqual({
      type: "ethereum_asset",
      chain: "Ethereum",
      address: "0xdeadbeef",
    });
  });

  it("resolves Here => origin chain native", () => {
    const ml = { parents: 0, interior: { Here: {} } };
    const token = identifyTokenFromMultiLocation("polkadot", ml as any);
    expect(token.type).toBe("native");
    expect(token.chain).toBe("polkadot");
  });

  it("resolves parachain native asset", () => {
    const paraChain = subscanChains.chains.find((c) => c.paraId === 2000);
    const ml = {
      parents: 0,
      interior: { X1: { Parachain: paraChain.paraId } },
    };
    const token = identifyTokenFromMultiLocation("polkadot", ml as any);
    expect(token.type).toBe("native");
    expect(token.chain).toBe(paraChain.domain);
  });

  it("resolves parachain general index asset", () => {
    const paraId = subscanChains.chains.find((c) => c.paraId)?.paraId ?? 2000;
    const ml = {
      parents: 0,
      interior: {
        X2: [{ Parachain: paraId }, { GeneralIndex: 42 }],
      },
    };
    const token = identifyTokenFromMultiLocation("polkadot", ml as any);
    expect(token).toMatchObject({ type: "parachain_asset", generalIndex: 42 });
  });

  it("falls back to relay chain native if parents==1", () => {
    const ml = { parents: 1, interior: {} };
    const token = identifyTokenFromMultiLocation("polkadot", ml as any);
    expect(token.type).toBe("native");
    expect(token.chain).toBe(polkadotRelay);
  });

  it("falls back to origin chain native if parents==0 and no junctions", () => {
    const ml = { parents: 0, interior: {} };
    const token = identifyTokenFromMultiLocation("polkadot", ml as any);
    expect(token.type).toBe("native");
    expect(token.chain).toBe("polkadot");
  });

  it("returns unknown for unhandled case", () => {
    const ml = { parents: 2, interior: { X1: { Unknown: "??" } } };
    const token = identifyTokenFromMultiLocation("polkadot", ml as any);
    expect(token.type).toBe("unknown");
  });
});
