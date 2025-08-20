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

  it("falls back to native token resolution if no asset match and balance deposit event exists", async () => {
    const messages: XcmTransfer[] = [
      {
        timestamp: 999,
        transfers: [
          {
            destChain: "moonbeam",
            amount: 2,
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
    expect(transfer.amount).toBeCloseTo(2);
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
