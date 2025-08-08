import { expect, it, jest, describe, beforeEach } from "@jest/globals";
import { XcmTokenResolutionService } from "../services/xcm-token-resolution.service";
import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { Asset } from "../../blockchain/substrate/model/asset";
import {
  EventDetails,
  SubscanEvent,
} from "../../blockchain/substrate/model/subscan-event";
import { XcmTransfer } from "../../blockchain/substrate/model/xcm-transfer";

jest.mock("../../../../res/gen/subscan-chains.json", () => ({
  chains: [
    {
      domain: "moonbeam",
      assetPallet: true,
      foreignAssetsPallet: true,
    },
  ],
}));

describe("XcmTokenResolutionService", () => {
  let service: XcmTokenResolutionService;
  let subscanService: jest.Mocked<SubscanService>;

  beforeEach(() => {
    subscanService = {
      scanTokens: jest.fn(),
      scanAssets: jest.fn(),
      fetchForeignAssets: jest.fn(),
      fetchNativeToken: jest.fn<any>(),
      fetchEventDetails: jest.fn(),
    } as any;

    service = new XcmTokenResolutionService(subscanService);
  });

  it("resolves tokens correctly for matching deposits", async () => {
    // Arrange
    const mockAssets: Asset[] = [
      {
        asset_id: "100",
        symbol: "DOT",
        decimals: 10,
        unique_id: "DOT-100",
      } as Asset,
    ];

    const mockEvents: SubscanEvent[] = [
      {
        event_id: "Deposited",
        module_id: "tokens",
        timestamp: 12345,
        event_index: "0x001",
      },
    ] as any;

    const mockEventDetails: EventDetails[] = [
      {
        timestamp: 12345,
        module_id: "tokens",
        original_event_index: "0x001",
        params: [
          { name: "currency_id", value: "100" },
          { name: "amount", value: "10000000000" }, // 1 DOT
        ],
      },
    ] as any;

    const messages: XcmTransfer[] = [
      {
        timestamp: 12345,
        transfers: [
          {
            destChain: "moonbeam",
            rawAmount: "10000000000",
            symbol: "DOT",
            asset_unique_id: "",
          },
        ],
      } as any,
    ];

    subscanService.scanTokens.mockResolvedValue(mockAssets);
    subscanService.scanAssets.mockResolvedValue([]);
    subscanService.fetchForeignAssets.mockResolvedValue([]);
    subscanService.fetchEventDetails.mockResolvedValue(mockEventDetails);
    (subscanService.fetchNativeToken as jest.Mock<any>).mockResolvedValue({
      token_decimals: 12,
    });

    // Act
    const result = await service.resolveTokens(
      { domain: "moonbeam", token: "DOT" },
      messages,
      mockEvents,
    );

    // Assert
    const transfer = result[0].transfers[0];
    expect(transfer.symbol).toBe("DOT");
    expect(transfer.asset_unique_id).toBe("DOT-100");
    expect(transfer.amount).toBe(1); // 10 decimals = 1.0
  });

  it("falls back to native token resolution if no asset match and balance deposit event exists", async () => {
    const messages: XcmTransfer[] = [
      {
        timestamp: 999,
        transfers: [
          {
            destChain: "moonbeam",
            rawAmount: "1230000000000",
            symbol: "DOT",
            asset_unique_id: "",
          },
        ],
      } as any,
    ];

    const nativeToken = { token_decimals: 12 };

    subscanService.scanTokens.mockResolvedValue([]);
    subscanService.scanAssets.mockResolvedValue([]);
    subscanService.fetchForeignAssets.mockResolvedValue([]);
    subscanService.fetchEventDetails.mockResolvedValue([]);
    (subscanService.fetchNativeToken as jest.Mock<any>).mockResolvedValue(
      nativeToken,
    );

    const mockEvents: SubscanEvent[] = [
      {
        event_id: "Deposited",
        module_id: "balances",
        timestamp: 999,
        event_index: "0x123",
      },
    ] as any;

    const result = await service.resolveTokens(
      { domain: "moonbeam", token: "DOT" },
      messages,
      mockEvents,
    );

    const transfer = result[0].transfers[0];
    expect(transfer.symbol).toBe("DOT");
    expect(transfer.asset_unique_id).toBe("DOT");
    expect(transfer.amount).toBeCloseTo(1.23);
  });

  it("leaves symbol/asset_id undefined if no match is found", async () => {
    const messages: XcmTransfer[] = [
      {
        timestamp: 1111,
        transfers: [
          {
            destChain: "moonbeam",
            rawAmount: "50000000000",
            symbol: "UNMAPPED",
            asset_unique_id: "",
          },
        ],
      } as any,
    ];

    subscanService.scanTokens.mockResolvedValue([]);
    subscanService.scanAssets.mockResolvedValue([]);
    subscanService.fetchForeignAssets.mockResolvedValue([]);
    subscanService.fetchEventDetails.mockResolvedValue([]);
    (subscanService.fetchNativeToken as jest.Mock<any>).mockResolvedValue({
      token_decimals: 12,
    });

    const result = await service.resolveTokens(
      { domain: "moonbeam", token: "DOT" },
      messages,
      [],
    );

    const transfer = result[0].transfers[0];
    expect(transfer.symbol).toBe("UNMAPPED");
    expect(transfer.asset_unique_id).toBeUndefined();
  });
});
