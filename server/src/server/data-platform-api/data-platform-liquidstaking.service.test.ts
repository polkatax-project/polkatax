import { DataPlatformApi } from "./data-platform.api";
import { SubscanService } from "../blockchain/substrate/api/subscan.service";
import { Asset } from "../blockchain/substrate/model/asset";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { DataPlatformLiquidStakingService } from "./data-platform-liquidstaking.service";

jest.mock("../logger/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

jest.mock("../../common/util/convert-to-generic-address", () => ({
  convertToGenericAddress: jest.fn().mockReturnValue("genericAddress"),
}));

jest.mock("../../common/util/is-valid-address", () => ({
  isValidEvmAddress: jest.fn().mockReturnValue(false),
}));

jest.mock("../../common/util/date-utils", () => ({
  formatDate: jest.fn((d: Date) => d.toISOString()),
}));

describe("DataPlatformLiquidStakingService", () => {
  let service: DataPlatformLiquidStakingService;
  let mockApi: jest.Mocked<DataPlatformApi>;
  let mockSubscan: jest.Mocked<SubscanService>;

  const mockTokens: Asset = [
    {
      token_id: { VToken: "BNC" },
      decimals: 12,
      symbol: "vBNC",
      unique_id: "vBNC-1",
    },
    {
      token_id: { VToken2: 0 },
      decimals: 10,
      symbol: "vDOT",
      unique_id: "vDOT-1",
    },
  ] as any;

  beforeEach(() => {
    mockApi = {
      fetchLiquidStakingMintedEvents: jest.fn(),
      fetchLiquidStakingRedeemedEvents: jest.fn(),
      fetchLiquidStakingRebondedEvents: jest.fn(),
    } as any;

    mockSubscan = {
      scanTokens: jest.fn<any>().mockResolvedValue(mockTokens),
      fetchEventDetails: jest
        .fn<any>()
        .mockResolvedValue([
          { extrinsic_index: "1-2", extrinsic_hash: "0xabc" },
        ]),
    } as any;

    service = new DataPlatformLiquidStakingService(mockApi, mockSubscan);
  });

  describe("fetchallVtokenEvents", () => {
    it("returns [] for unsupported chains", async () => {
      const result = await service.fetchallVtokenEvents(
        "addr",
        "ethereum",
        1000,
      );
      expect(result).toEqual([]);
    });

    it("fetches and merges events from all sources", async () => {
      mockApi.fetchLiquidStakingMintedEvents.mockResolvedValue({
        items: [
          {
            chainType: "POLKADOT",
            liquidStakingResults: [
              {
                eventId: "1-0-2",
                timestamp: "2023-01-01T00:00:00Z",
                vestedAmount: 100,
                currencyType: "Native",
                currencyValue: "BNC",
              },
            ],
          } as any,
        ],
      });
      mockApi.fetchLiquidStakingRedeemedEvents.mockResolvedValue({
        items: [{ chainType: "POLKADOT", liquidStakingResults: [] }],
      });
      mockApi.fetchLiquidStakingRebondedEvents.mockResolvedValue({
        items: [{ chainType: "POLKADOT", liquidStakingResults: [] }],
      });

      const result = await service.fetchallVtokenEvents(
        "addr",
        "bifrost",
        0,
        Date.now(),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        symbol: "vBNC",
        amount: expect.any(Number),
        extrinsic_index: "1-2",
        hash: "0xabc",
      });
    });
  });

  describe("fetchVtokenMintedEvents", () => {
    it("throws if vToken not found", async () => {
      mockSubscan.scanTokens.mockResolvedValue([]); // no tokens
      mockApi.fetchLiquidStakingMintedEvents.mockResolvedValue({
        items: [
          {
            chainType: "POLKADOT",
            liquidStakingResults: [
              {
                eventId: "1-0-2",
                timestamp: "2023-01-01T00:00:00Z",
                vestedAmount: 100,
                currencyType: "Token2",
                currencyValue: "0",
              },
            ],
          } as any,
        ],
      });

      await expect(
        service.fetchVtokenMintedEvents(
          "addr",
          "bifrost",
          "2023-01-01",
          "2023-02-01",
        ),
      ).rejects.toThrow("vToken for event vtokenmintingMinted");
    });

    it("constructs transfers correctly", async () => {
      mockApi.fetchLiquidStakingMintedEvents.mockResolvedValue({
        items: [
          {
            chainType: "POLKADOT",
            liquidStakingResults: [
              {
                eventId: "1-0-2",
                timestamp: "2023-01-01T00:00:00Z",
                vestedAmount: 100,
                currencyType: "Token2",
                currencyValue: "0",
              },
            ],
          } as any,
        ],
      });

      const result = await service.fetchVtokenMintedEvents(
        "addr",
        "bifrost",
        "2023-01-01",
        "2023-02-01",
      );
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Liquid staking token minted");
      expect(result[0].amount).toBeCloseTo(100 * Math.pow(10, -12));
    });
  });

  describe("fetchVtokenRedeemedEvents", () => {
    it("constructs redeemed transfers correctly", async () => {
      mockApi.fetchLiquidStakingRedeemedEvents.mockResolvedValue({
        items: [
          {
            chainType: "POLKADOT",
            liquidStakingResults: [
              {
                eventId: "2-0-3",
                timestamp: "2023-01-02T00:00:00Z",
                vestedCurrencyAmount: 200,
                currencyType: "Native",
                currencyValue: "BNC",
              },
            ],
          } as any,
        ],
      });

      const result = await service.fetchVtokenRedeemedEvents(
        "addr",
        "bifrost",
        "2023-01-01",
        "2023-02-01",
      );
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Liquid staking token redeemed");
    });
  });

  describe("fetchVtokenRebondedEvents", () => {
    it("constructs rebonded transfers correctly", async () => {
      mockApi.fetchLiquidStakingRebondedEvents.mockResolvedValue({
        items: [
          {
            chainType: "POLKADOT",
            liquidStakingResults: [
              {
                eventId: "3-0-4",
                timestamp: "2023-01-03T00:00:00Z",
                vestedAmount: 300,
                currencyType: "Native",
                currencyValue: "BNC",
              },
            ],
          } as any,
        ],
      });

      const result = await service.fetchVtokenRebondedEvents(
        "addr",
        "bifrost",
        "2023-01-01",
        "2023-02-01",
      );
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Liquid staking token minted");
    });
  });

  describe("determineVToken", () => {
    it("returns correct vtoken for Native BNC", () => {
      const result = (service as any).determineVToken(
        "Native",
        "BNC",
        mockTokens,
      );
      expect(result).toEqual(mockTokens[0]);
    });

    it("returns correct vtoken for DOT", () => {
      const result = (service as any).determineVToken(
        "Token2",
        "0",
        mockTokens,
      );
      expect(result).toEqual(mockTokens[1]);
    });

    it("returns undefined for missing token", () => {
      const result = (service as any).determineVToken("Native", "blub", []);
      expect(result).toBeUndefined();
    });
  });

  describe("toSubscanEventIndex", () => {
    it("converts eventId to correct format", () => {
      const idx = (service as any).toSubscanEventIndex("123-1-456");
      expect(idx).toBe("123-456");
    });
  });
});
