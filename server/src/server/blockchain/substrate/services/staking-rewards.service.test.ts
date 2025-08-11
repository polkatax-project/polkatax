import { expect, it, jest, describe, beforeEach } from "@jest/globals";

jest.mock("../../../data-aggregation/helper/is-evm-address", () => ({
  isEvmAddress: jest.fn(),
}));

jest.mock("../../../data-aggregation/helper/get-native-token", () => ({
  getNativeToken: jest.fn(() => "DOT"),
}));

import { isEvmAddress } from "../../../data-aggregation/helper/is-evm-address";
import { getNativeToken } from "../../../data-aggregation/helper/get-native-token";
import { StakingRewardsService } from "./staking-rewards.service";
import { SubscanService } from "../api/subscan.service";
import { StakingRewardsViaEventsService } from "./staking-rewards-via-events.service";

describe("StakingRewardsService", () => {
  let service: StakingRewardsService;
  const mockSubscanService = {
    mapToSubstrateAccount: jest.fn(),
    fetchNativeToken: jest.fn(),
    fetchAllStakingRewards: jest.fn(),
  } as unknown as jest.Mocked<SubscanService>;

  const mockViaEventsService = {
    fetchStakingRewards: jest.fn(),
  } as unknown as jest.Mocked<StakingRewardsViaEventsService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StakingRewardsService(
      mockSubscanService,
      mockViaEventsService,
    );
  });

  it("should map EVM address to substrate and return rewards from subscan", async () => {
    (isEvmAddress as jest.Mock).mockReturnValue(true);
    mockSubscanService.mapToSubstrateAccount.mockResolvedValue(
      "substrateAddress",
    );
    mockSubscanService.fetchNativeToken.mockResolvedValue({
      token_decimals: 10,
    } as any);

    mockSubscanService.fetchAllStakingRewards.mockResolvedValue([
      {
        amount: "10000000000", // 1 DOT
        timestamp: 1690000000,
        block: 123,
        hash: "0xabc",
        event_index: "1-1",
        extrinsic_index: "1-1",
        event_id: "Reward",
      },
      {
        amount: "5000000000", // -0.5 DOT
        timestamp: 1690000050,
        block: 124,
        hash: "0xdef",
        event_index: "1-2",
        extrinsic_index: "1-2",
        event_id: "Slash",
      },
    ] as any);

    const result = await service.fetchStakingRewards({
      chainName: "polkadot",
      address: "0xEvmAddress",
      minDate: 1690000000,
    });

    expect(mockSubscanService.mapToSubstrateAccount).toHaveBeenCalledWith(
      "polkadot",
      "0xEvmAddress",
    );
    expect(mockSubscanService.fetchAllStakingRewards).toHaveBeenCalledWith({
      chainName: "polkadot",
      address: "substrateAddress",
      minDate: 1690000000,
      maxDate: undefined,
    });

    expect(result).toEqual([
      {
        amount: 1,
        timestamp: 1690000000,
        block: 123,
        hash: "0xabc",
        event_index: "1-1",
        extrinsic_index: "1-1",
        asset_unique_id: "DOT",
      },
      {
        amount: -0.5,
        timestamp: 1690000050,
        block: 124,
        hash: "0xdef",
        event_index: "1-2",
        extrinsic_index: "1-2",
        asset_unique_id: "DOT",
      },
    ]);
  });

  it("should fetch via StakingRewardsViaEventsService for energywebx", async () => {
    (isEvmAddress as jest.Mock).mockReturnValue(false);
    mockViaEventsService.fetchStakingRewards.mockResolvedValue([
      {
        amount: 1,
        timestamp: 1690000000,
        block: 123,
        hash: "0xabc",
        event_index: "1-1",
        extrinsic_index: "1-1",
      },
    ] as any);

    const result = await service.fetchStakingRewards({
      chainName: "energywebx",
      address: "0x123",
      minDate: 1690000000,
    });

    expect(mockViaEventsService.fetchStakingRewards).toHaveBeenCalledWith(
      "energywebx",
      "0x123",
      "parachainstaking",
      "Rewarded",
      1690000000,
      undefined,
    );

    expect(result).toEqual([
      {
        amount: 1,
        timestamp: 1690000000,
        block: 123,
        hash: "0xabc",
        event_index: "1-1",
        extrinsic_index: "1-1",
        asset_unique_id: "DOT",
      },
    ]);
  });

  it("should return empty for acala and mythos", async () => {
    (isEvmAddress as jest.Mock).mockReturnValue(false);

    const mythosResult = await service.fetchStakingRewards({
      chainName: "mythos",
      address: "0xabc",
      minDate: 1690000000,
    });

    const acalaResult = await service.fetchStakingRewards({
      chainName: "acala",
      address: "0xabc",
      minDate: 1690000000,
    });

    expect(mythosResult).toEqual([]);
    expect(acalaResult).toEqual([]);
    expect(mockSubscanService.fetchAllStakingRewards).not.toHaveBeenCalled();
    expect(mockViaEventsService.fetchStakingRewards).not.toHaveBeenCalled();
  });
});
