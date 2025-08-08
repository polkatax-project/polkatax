import { expect, it, jest, describe, beforeEach } from "@jest/globals";
import { SubscanService } from "../api/subscan.service";
import { EthTokenInfoService } from "../../evm/service/eth.token-info.service";
import { Asset } from "../model/asset";
import * as findProp from "../../../../common/util/find-property-value-nested";
import { XcmTokenResolver } from "./xcm-token-resolver";

describe("XcmTokenResolver", () => {
  let subscanService: jest.Mocked<SubscanService>;
  let ethTokenInfoService: jest.Mocked<EthTokenInfoService>;
  let resolver: XcmTokenResolver;

  beforeEach(() => {
    subscanService = {
      scanTokens: jest.fn(),
      scanAssets: jest.fn(),
      fetchForeignAssets: jest.fn(),
      fetchNativeToken: jest.fn(),
    } as any;

    ethTokenInfoService = {
      fetchTokenInfo: jest.fn(),
    } as any;

    resolver = new XcmTokenResolver(subscanService, ethTokenInfoService);
  });

  it("Case 1: returns token matched by unique_id", async () => {
    const mockAsset: Asset = {
      symbol: "ABC",
      unique_id: "abc-1",
      decimals: 12,
    } as any;

    subscanService.scanTokens.mockResolvedValue([mockAsset]);
    subscanService.scanAssets.mockResolvedValue([]);
    subscanService.fetchForeignAssets.mockResolvedValue([]);

    const result = await resolver.determineOriginToken(
      { asset_unique_id: "abc-1", symbol: "ABC" } as any,
      "moonbeam",
    );

    expect(result).toEqual(mockAsset);
  });

  it("Case 2: matches relay chain token by symbol", async () => {
    const relayAsset: Asset = {
      symbol: "DOT",
      unique_id: "dot-relay",
      decimals: 10,
    } as any;

    subscanService.scanTokens.mockResolvedValue([relayAsset]);
    subscanService.scanAssets.mockResolvedValue([]);
    subscanService.fetchForeignAssets.mockResolvedValue([]);

    const result = await resolver.determineOriginToken(
      { asset_unique_id: "DOT", symbol: "DOT" } as any,
      "polkadot",
    );

    expect(result).toEqual(relayAsset);
  });

  it("Case 3: ethereum/ address - resolves via EthTokenInfoService", async () => {
    ethTokenInfoService.fetchTokenInfo.mockResolvedValue({
      symbol: "DAI",
      decimals: 18,
    });

    const result = await resolver.determineOriginToken(
      {
        asset_unique_id: "ethereum/0xabc",
        symbol: "DAI",
      } as any,
      "moonbeam",
    );

    expect(ethTokenInfoService.fetchTokenInfo).toHaveBeenCalledWith("0xabc");
    expect(result).toEqual({ symbol: "DAI", decimals: 18 });
  });

  it("Case 4: nested Ethereum interior.X2 → resolves via EthTokenInfoService", async () => {
    jest.spyOn(findProp, "getNestedValue").mockImplementation((obj, path) => {
      if (path === "interior.X2.col0.GlobalConsensus.Ethereum") return true;
      if (path === "interior.X2.col1.AccountKey20.key") return "0xdef";
      return undefined;
    });

    ethTokenInfoService.fetchTokenInfo.mockResolvedValue({
      symbol: "USDC",
      decimals: 6,
    });

    const result = await resolver.determineOriginToken(
      {
        raw: {
          interior: {
            X2: {
              col0: { GlobalConsensus: { Ethereum: {} } },
              col1: { AccountKey20: { key: "0xdef" } },
            },
          },
        },
        symbol: "USDC",
      } as any,
      "moonbeam",
    );

    expect(result).toEqual({ symbol: "USDC", decimals: 6 });
  });

  it("Case 5: no symbol provided → fallback to native token symbol and decimals", async () => {
    subscanService.fetchNativeToken.mockResolvedValue({
      token_decimals: 18,
    } as any);

    const result = await resolver.determineOriginToken(
      {
        symbol: undefined,
        asset_unique_id: undefined,
      } as any,
      "moonbeam", // moonbeam has GLMR as native token
    );

    expect(result).toEqual({
      symbol: "GLMR",
      unique_id: "GLMR",
      decimals: 18,
    });
  });

  it("Case 6: fallback to symbol search with 1 result", async () => {
    const token = { symbol: "DOT", unique_id: "dot-x" };
    subscanService.scanTokens.mockResolvedValue([token] as any);

    const result = await resolver.determineOriginToken(
      { symbol: "DOT", asset_unique_id: "unknown" } as any,
      "polkadot",
    );

    expect(result).toEqual(token);
  });

  it("Case 6: fallback to symbol with multiple results → return minimal object", async () => {
    const tokenA = { symbol: "ABC", unique_id: "abc-1" };
    const tokenB = { symbol: "ABC", unique_id: "abc-2" };
    subscanService.scanTokens.mockResolvedValue([tokenA, tokenB] as any);

    const result = await resolver.determineOriginToken(
      { symbol: "ABC", asset_unique_id: "zzz" } as any,
      "kusama",
    );

    expect(result).toEqual({ symbol: "ABC", unique_id: undefined });
  });
});
