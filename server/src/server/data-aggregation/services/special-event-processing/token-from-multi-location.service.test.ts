import { TokenFromMultiLocationService } from "./token-from-multi-location.service";
import { identifyTokenFromMultiLocation } from "../../../blockchain/substrate/util/identify-token-from-multi-location";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock(
  "../../../blockchain/substrate/util/identify-token-from-multi-location",
);

const mockSubscanService = {
  scanTokens: jest.fn<any>(),
  scanAssets: jest.fn<any>(),
  fetchForeignAssets: jest.fn<any>(),
  fetchNativeToken: jest.fn<any>(),
};

const mockEthTokenInfoService = {
  fetchTokenInfo: jest.fn<any>(),
};

describe("TokenFromMultiLocationService", () => {
  let service: TokenFromMultiLocationService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new TokenFromMultiLocationService(
      mockSubscanService as any,
      mockEthTokenInfoService as any,
    );
  });

  it("should return ETH as native when ethereum_asset without address", async () => {
    (identifyTokenFromMultiLocation as jest.Mock).mockReturnValue({
      type: "ethereum_asset",
      address: undefined,
    });

    const result = await service.extractTokenInfoFromMultiLocation(
      { token: "ETH", domain: "ethereum" },
      {} as any,
    );

    expect(result).toEqual({ symbol: "ETH", decimals: 18, unique_id: "ETH" });
  });

  it("should fetch ERC20 token info when ethereum_asset with address", async () => {
    (identifyTokenFromMultiLocation as jest.Mock).mockReturnValue({
      type: "ethereum_asset",
      address: "0x123",
    });
    mockEthTokenInfoService.fetchTokenInfo.mockResolvedValue({
      symbol: "DAI",
      decimals: 18,
    } as any);

    const result = await service.extractTokenInfoFromMultiLocation(
      { token: "ETH", domain: "ethereum" },
      {} as any,
    );

    expect(mockEthTokenInfoService.fetchTokenInfo).toHaveBeenCalledWith(
      "ethereum",
      "0x123",
    );
    expect(result).toEqual({
      symbol: "DAI",
      decimals: 18,
      unique_id: "ethereum/0x123",
    });
  });

  it("should resolve parachain_asset from fetchAssets", async () => {
    (identifyTokenFromMultiLocation as jest.Mock).mockReturnValue({
      type: "parachain_asset",
      generalIndex: 42,
    });
    mockSubscanService.scanTokens.mockResolvedValue([
      { asset_id: 42, symbol: "DOT", decimals: 10 },
    ]);
    mockSubscanService.scanAssets.mockResolvedValue([]);
    mockSubscanService.fetchForeignAssets.mockResolvedValue([]);

    const result = await service.extractTokenInfoFromMultiLocation(
      { token: "DOT", domain: "polkadot" },
      {} as any,
    );

    expect(result).toEqual({ symbol: "DOT", decimals: 10 });
  });

  it("should resolve native token decimals", async () => {
    (identifyTokenFromMultiLocation as jest.Mock).mockReturnValue({
      type: "native",
      chain: "polkadot",
      symbol: "DOT",
    });
    mockSubscanService.fetchNativeToken.mockResolvedValue({
      token_decimals: 10,
    });

    const result = await service.extractTokenInfoFromMultiLocation(
      { token: "DOT", domain: "polkadot" },
      {} as any,
    );

    expect(result).toEqual({ symbol: "DOT", decimals: 10, unique_id: "DOT" });
  });

  it("should return undefined when token not found", async () => {
    (identifyTokenFromMultiLocation as jest.Mock).mockReturnValue({
      type: "parachain_asset",
      generalIndex: 99,
    });
    mockSubscanService.scanTokens.mockResolvedValue([]);
    mockSubscanService.scanAssets.mockResolvedValue([]);
    mockSubscanService.fetchForeignAssets.mockResolvedValue([]);

    const result = await service.extractTokenInfoFromMultiLocation(
      { token: "DOT", domain: "polkadot" },
      {} as any,
    );

    expect(result).toEqual({ symbol: undefined, decimals: undefined });
  });
});
