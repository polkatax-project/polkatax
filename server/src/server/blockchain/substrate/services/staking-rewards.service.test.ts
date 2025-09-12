import { expect, it, jest, describe, beforeEach } from "@jest/globals";

jest.mock("../../../data-aggregation/helper/is-evm-address", () => ({
  isEvmAddress: jest.fn(),
}));

import { isEvmAddress } from "../../../data-aggregation/helper/is-evm-address";
import { StakingRewardsService } from "./staking-rewards.service";
import { SubscanService } from "../api/subscan.service";

describe("StakingRewardsService", () => {
  let service: StakingRewardsService;
  const mockSubscanService = {
    mapToSubstrateAccount: jest.fn(),
    fetchNativeToken: jest.fn(),
    fetchAllStakingRewards: jest.fn(),
  } as unknown as jest.Mocked<SubscanService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StakingRewardsService(mockSubscanService);
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
        symbol: "DOT",
      },
      {
        amount: -0.5,
        timestamp: 1690000050,
        block: 124,
        hash: "0xdef",
        event_index: "1-2",
        extrinsic_index: "1-2",
        asset_unique_id: "DOT",
        symbol: "DOT",
      },
    ]);
  });
});
