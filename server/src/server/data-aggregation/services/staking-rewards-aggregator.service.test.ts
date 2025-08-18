import { StakingRewardsAggregatorService } from "./staking-rewards-aggregator.service";
import { StakingRewardsService } from "../../blockchain/substrate/services/staking-rewards.service";
import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { DataPlatformStakingService } from "../../data-platform-api/data-platform-staking.service";
import { isEvmAddress } from "../helper/is-evm-address";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../helper/is-evm-address", () => ({
  isEvmAddress: jest.fn(),
}));

jest.mock("../../../../res/gen/subscan-chains.json", () => ({
  chains: [
    { domain: "polkadot", stakingPallets: ["staking"], pseudoStaking: false },
    { domain: "kusama", stakingPallets: ["staking"], pseudoStaking: false },
    { domain: "hydration", stakingPallets: ["staking"], pseudoStaking: false },
    { domain: "enjin", stakingPallets: ["staking"], pseudoStaking: false },
    { domain: "mychain", stakingPallets: ["staking"], pseudoStaking: false },
  ],
}));

describe("StakingRewardsAggregatorService", () => {
  let service: StakingRewardsAggregatorService;
  let stakingRewardsService: jest.Mocked<StakingRewardsService>;
  let subscanService: jest.Mocked<SubscanService>;
  let dataPlatformStakingService: jest.Mocked<DataPlatformStakingService>;

  const baseRequest = {
    address: "0x123",
    chain: { domain: "mychain", token: "MYT" },
    minDate: "2023-01-01",
  };

  beforeEach(() => {
    stakingRewardsService = {
      fetchStakingRewards: jest.fn(),
    } as any;

    subscanService = {
      mapToSubstrateAccount: jest.fn(),
    } as any;

    dataPlatformStakingService = {
      fetchAggregatedStakingRewardsForChain: jest.fn(),
    } as any;

    service = new StakingRewardsAggregatorService(
      stakingRewardsService,
      subscanService,
      dataPlatformStakingService,
    );

    (isEvmAddress as jest.Mock).mockReset().mockReturnValue(false);
    jest.resetModules();
  });

  describe("fetchFromSubscan", () => {
    it("calls fetchStakingRewards directly for non-EVM address", async () => {
      stakingRewardsService.fetchStakingRewards.mockResolvedValue([
        { era: 1, amount: 10 },
      ] as any);

      const result = await (service as any).fetchFromSubscan(baseRequest);

      expect(stakingRewardsService.fetchStakingRewards).toHaveBeenCalledWith({
        chainName: "mychain",
        address: "0x123",
        minDate: "2023-01-01",
      });
      expect(result).toHaveLength(1);
    });

    it("maps EVM address before fetching", async () => {
      (isEvmAddress as jest.Mock).mockReturnValue(true);
      subscanService.mapToSubstrateAccount.mockResolvedValue("mapped-addr");
      stakingRewardsService.fetchStakingRewards.mockResolvedValue([
        { era: 2, amount: 20 },
      ] as any);

      const result = await (service as any).fetchFromSubscan(baseRequest);

      expect(subscanService.mapToSubstrateAccount).toHaveBeenCalledWith(
        "mychain",
        "0x123",
      );
      expect(stakingRewardsService.fetchStakingRewards).toHaveBeenCalledWith(
        expect.objectContaining({ address: "mapped-addr" }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("fetchStakingRewards", () => {
    it("returns empty arrays if chain not found", async () => {
      const req = {
        ...baseRequest,
        chain: { domain: "unknown", token: "UNK" },
      };
      const result = await service.fetchStakingRewards(req as any);
      expect(result).toEqual({ rawStakingRewards: [], aggregatedRewards: [] });
    });

    it("uses subscan for non-special chains", async () => {
      stakingRewardsService.fetchStakingRewards.mockResolvedValue([
        { era: 1, amount: 100 },
      ] as any);

      const result = await service.fetchStakingRewards(baseRequest as any);

      expect(result.aggregatedRewards).toEqual([]);
      expect(result.rawStakingRewards).toHaveLength(1);
    });

    it("uses data platform API for polkadot when USE_DATA_PLATFORM_API=true", async () => {
      process.env["USE_DATA_PLATFORM_API"] = "true";
      dataPlatformStakingService.fetchAggregatedStakingRewardsForChain.mockResolvedValue(
        [{ address: "addr", totalReward: 500 }] as any,
      );

      const req = {
        ...baseRequest,
        chain: { domain: "polkadot", token: "DOT" },
      };

      const result = await service.fetchStakingRewards(req as any);

      expect(result.rawStakingRewards).toEqual([]);
      expect(result.aggregatedRewards).toHaveLength(1);
    });

    it("uses subscan for polkadot when USE_DATA_PLATFORM_API is not set", async () => {
      delete process.env["USE_DATA_PLATFORM_API"];
      stakingRewardsService.fetchStakingRewards.mockResolvedValue([
        { era: 5, amount: 50 },
      ] as any);

      const req = {
        ...baseRequest,
        chain: { domain: "polkadot", token: "DOT" },
      };

      const result = await service.fetchStakingRewards(req as any);

      expect(result.aggregatedRewards).toEqual([]);
      expect(result.rawStakingRewards).toHaveLength(1);
    });
  });
});
