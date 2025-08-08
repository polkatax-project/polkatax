import { XcmService } from "./xcm.service";
import { XcmTokenResolver } from "./xcm-token-resolver";
import { expect, it, jest, describe, beforeEach } from "@jest/globals";
import { SubscanService } from "../api/subscan.service";

// Mock data
const mockXcmList = [
  {
    id: "xcm-id",
    message_hash: "hash123",
    from_account_id: "0x123",
    to_account_id: "0x456",
    origin_para_id: 2030, // bifrost
    dest_para_id: 1000, // assethub-polkadot
    origin_block_timestamp: 1690000000,
    confirm_block_timestamp: 1690000500,
    extrinsic_index: "0xaaa",
    dest_extrinsic_index: "0xbbb",
    assets: [
      {
        amount: "1000000000000",
        symbol: "DOT",
        current_currency_amount: "50",
        history_currency_amount: "48",
        decimals: 10,
      },
    ],
  },
];

const mockNativeToken = { token_decimals: 10 };

// Create fully mocked service instances
const mockSubscanService: jest.Mocked<SubscanService> = {
  fetchNativeToken: jest.fn<any>().mockResolvedValue(mockNativeToken),
  fetchXcmList: jest.fn<any>().mockResolvedValue(mockXcmList),
  scanTokens: jest.fn(),
  scanAssets: jest.fn(),
  fetchForeignAssets: jest.fn(),
} as any;

const mockTokenResolver: jest.Mocked<XcmTokenResolver> = {
  determineOriginToken: jest.fn<any>().mockResolvedValue({
    symbol: "DOT",
    unique_id: "DOT",
    decimals: 10,
  }),
} as any;

describe("XcmService", () => {
  let service: XcmService;

  beforeEach(() => {
    service = new XcmService(mockSubscanService, mockTokenResolver);
    jest.clearAllMocks();
  });

  it("fetches and processes XCM transfers correctly", async () => {
    const result = await service.fetchXcmTransfers({
      chainName: "bifrost",
      address: "0x456",
      minDate: 1680000000,
    });

    expect(mockSubscanService.fetchNativeToken).toHaveBeenCalledWith("bifrost");
    expect(mockSubscanService.fetchXcmList).toHaveBeenCalled();

    expect(mockTokenResolver.determineOriginToken).toHaveBeenCalled();

    expect(result).toHaveLength(1);

    const transfer = result[0];

    expect(transfer.messageHash).toBe("hash123");
    expect(transfer.transfers[0].symbol).toBe("DOT");
    expect(transfer.transfers[0].amount).toBe(-100); // 1 DOT
    expect(transfer.transfers[0].price).toBeCloseTo(0.5); // 50 / 100
    expect(transfer.transfers[0].fiatValue).toBe(48);
    expect(transfer.transfers[0].fromChain).toBe("bifrost");
    expect(transfer.transfers[0].destChain).toBe("assethub-polkadot");
  });
});
