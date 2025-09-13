import { DataPlatformApi } from "./data-platform.api";
import { SubscanService } from "../blockchain/substrate/api/subscan.service";
import { Asset } from "../blockchain/substrate/model/asset";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { DataPlatformLiquidStakingService } from "./data-platform-liquidstaking.service";

// Mock logger
jest.mock("../logger/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe("DataPlatformLiquidStakingService", () => {
  let service: DataPlatformLiquidStakingService;
  let dataPlatformApi: jest.Mocked<DataPlatformApi>;
  let subscanService: jest.Mocked<SubscanService>;

  const mockTokens: Asset[] = [
    {
      token_id: { VToken: "BNC" },
      symbol: "vBNC",
      unique_id: "123",
      decimals: 12,
    } as any as Asset,
  ];

  beforeEach(() => {
    dataPlatformApi = {
      fetchLiquidStakingMintedEvents: jest.fn(),
      fetchLiquidStakingRedeemedEvents: jest.fn(),
      fetchLiquidStakingRebondedEvents: jest.fn(),
    } as any;

    subscanService = {
      scanTokens: jest.fn(),
    } as any;

    service = new DataPlatformLiquidStakingService(
      dataPlatformApi,
      subscanService,
    );
    subscanService.scanTokens.mockResolvedValue(mockTokens);
  });

  it("should fetch minted events and map them to transfers", async () => {
    dataPlatformApi.fetchLiquidStakingMintedEvents.mockResolvedValue({
      items: [
        {
          chainType: "POLKADOT",
          liquidStakingResults: [
            {
              eventId: "12345-1",
              timestamp: "2025-01-01T00:00:00Z",
              vestedAmount: 1000000000000, // 1.0 after decimals
              extrinsicId: "12345-1-1",
              currencyType: "Native",
              currencyValue: '{"__kind": "BNC"}',
            } as any,
          ],
        },
      ],
    });

    const result = await service.fetchVtokenMintedEvents(
      "0xabc",
      "bifrost",
      "2025-01-01",
      "2025-01-02",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      symbol: "vBNC",
      asset_unique_id: "123",
      amount: 1,
      from: undefined,
      to: "0xabc",
      label: "Liquid staking token minted",
    });
  });

  it("should fetch redeemed events and map them to transfers", async () => {
    dataPlatformApi.fetchLiquidStakingRedeemedEvents.mockResolvedValue({
      items: [
        {
          chainType: "POLKADOT",
          liquidStakingResults: [
            {
              eventId: "12345-2",
              timestamp: "2025-01-02T00:00:00Z",
              vestedCurrencyAmount: 500000000000,
              extrinsicId: "12345-2-1",
              currencyType: "Native",
              currencyValue: '{"__kind": "BNC"}',
            } as any,
          ],
        },
      ],
    });

    const result = await service.fetchVtokenRedeemedEvents(
      "0xabc",
      "bifrost",
      "2025-01-01",
      "2025-01-03",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      symbol: "vBNC",
      asset_unique_id: "123",
      amount: 0.5,
      from: "0xabc",
      to: undefined,
      label: "Liquid staking token redeemed",
    });
  });

  it("should fetch rebonded events and map them to transfers", async () => {
    dataPlatformApi.fetchLiquidStakingRebondedEvents.mockResolvedValue({
      items: [
        {
          chainType: "POLKADOT",
          liquidStakingResults: [
            {
              eventId: "12345-3",
              timestamp: "2025-01-03T00:00:00Z",
              vestedCurrencyAmount: 2000000000000,
              extrinsicId: "12345-3-1",
              currencyType: "Native",
              currencyValue: '{"__kind": "BNC"}',
            } as any,
          ],
        },
      ],
    });

    const result = await service.fetchVtokenRebondedEvents(
      "0xabc",
      "bifrost",
      "2025-01-01",
      "2025-01-04",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      symbol: "vBNC",
      asset_unique_id: "123",
      amount: 2,
      from: undefined,
      to: "0xabc",
      label: "Liquid staking token minted", // note: rebonded reuses "minted"
    });
  });

  it("fetchallVtokenEvents should return [] for unsupported chain", async () => {
    const result = await service.fetchallVtokenEvents(
      "0xabc",
      "polkadot", // not bifrost or bifrost-kusama
      Date.now(),
      Date.now(),
    );
    expect(result).toEqual([]);
  });
});
