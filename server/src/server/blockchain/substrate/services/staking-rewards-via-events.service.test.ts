import { expect, it, jest, describe, beforeEach } from "@jest/globals";
import { SubscanService } from "../api/subscan.service";
import { SubscanEvent } from "../model/subscan-event";
import { StakingRewardsViaEventsService } from "./staking-rewards-via-events.service";
import { Transfer } from "../model/raw-transfer";

// Create mocked SubscanService
const mockSubscanService: jest.Mocked<SubscanService> = {
  searchAllEvents: jest.fn(),
  fetchAllTransfers: jest.fn(),
  fetchXcmList: jest.fn(),
  fetchNativeToken: jest.fn(),
  scanTokens: jest.fn(),
  scanAssets: jest.fn(),
  fetchForeignAssets: jest.fn(),
} as any;

describe("StakingRewardsViaEventsService", () => {
  let service: StakingRewardsViaEventsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StakingRewardsViaEventsService(mockSubscanService);
  });

  it("should return filtered and mapped staking rewards", async () => {
    const mockEvents: SubscanEvent[] = [
      {
        extrinsic_hash: "0xabc",
        event_index: "1-1",
      },
      {
        extrinsic_hash: "0xdef",
        event_index: "1-2",
      },
    ] as any;

    const mockTransfers: Transfer[] = [
      {
        amount: 10,
        timestamp: 1690000000,
        block: 100,
        hash: "0xabc",
        extrinsic_index: "1-1",
        fiatValue: 20,
        price: 2,
        asset_unique_id: "DOT",
      },
      {
        amount: -5,
        timestamp: 1690000050,
        block: 101,
        hash: "0xdef",
        extrinsic_index: "1-2",
        fiatValue: 10,
        price: 2,
        asset_unique_id: "DOT",
      },
      {
        amount: 20,
        timestamp: 1690000100,
        block: 102,
        hash: "0xghi", // Not in events
        extrinsic_index: "1-3",
        fiatValue: 40,
        price: 2,
        asset_unique_id: "DOT",
      },
    ] as any;

    mockSubscanService.searchAllEvents.mockResolvedValue(mockEvents);
    mockSubscanService.fetchAllTransfers.mockResolvedValue(mockTransfers);

    const result = await service.fetchStakingRewards(
      "polkadot",
      "0xaddress",
      "staking",
      "Reward",
      1690000000,
    );

    expect(result).toHaveLength(2);

    expect(result[0]).toEqual({
      event_id: "Reward",
      amount: 10,
      timestamp: 1690000000,
      block: 100,
      hash: "0xabc",
      event_index: "1-1",
      extrinsic_index: "1-1",
      fiatValue: 20,
      price: 2,
      asset_unique_id: "DOT",
    });

    expect(result[1]).toEqual({
      event_id: "Slash",
      amount: -5,
      timestamp: 1690000050,
      block: 101,
      hash: "0xdef",
      event_index: "1-2",
      extrinsic_index: "1-2",
      fiatValue: 10,
      price: 2,
      asset_unique_id: "DOT",
    });
  });

  it("should return an empty array if no matching hashes", async () => {
    mockSubscanService.searchAllEvents.mockResolvedValue([
      { extrinsic_hash: "0x111", event_index: "0-1" },
    ] as any);
    mockSubscanService.fetchAllTransfers.mockResolvedValue([
      {
        amount: 50,
        timestamp: 1690000000,
        block: 99,
        hash: "0x222", // not in events
        extrinsic_index: "0-2",
        fiatValue: 100,
        price: 2,
        asset_unique_id: "KSM",
      },
    ] as any);

    const result = await service.fetchStakingRewards(
      "kusama",
      "0xaddr",
      "staking",
      "Reward",
      1680000000,
    );

    expect(result).toEqual([]);
  });
});