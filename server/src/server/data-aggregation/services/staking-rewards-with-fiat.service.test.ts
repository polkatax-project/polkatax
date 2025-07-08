import { StakingRewardsWithFiatService } from "./staking-rewards-with-fiat.service";
import { StakingRewardsService } from "../../blockchain/substrate/services/staking-rewards.service";
import { TokenPriceConversionService } from "./token-price-conversion.service";
import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { DataPlatformService } from "../../data-platform-api/data-platform.service";
import { StakingRewardsRequest } from "../model/staking-rewards.request";
import { PricedStakingReward } from "../model/priced-staking-reward";
import { expect, it, jest, describe, beforeEach } from "@jest/globals";

jest.mock("../helper/add-fiat-values-to-staking-rewards", () => ({
  addFiatValuesToStakingRewards: jest.fn((rewards: any, quote: any) => {
    return rewards.map((r) => ({
      ...r,
      fiatValue: r.amount * (quote?.price || 1),
    }));
  }),
}));

jest.mock("../helper/find-coingecko-id-for-native-token", () => ({
  findCoingeckoIdForNativeToken: (domain: string) => {
    const map = {
      polkadot: "polkadot",
    };
    return map[domain];
  },
}));

jest.mock("../helper/is-evm-address", () => ({
  isEvmAddress: (address: string) => address.startsWith("0x"),
}));

describe("StakingRewardsWithFiatService", () => {
  let service: StakingRewardsWithFiatService;
  let stakingRewardsService: jest.Mocked<StakingRewardsService>;
  let tokenPriceConversionService: jest.Mocked<TokenPriceConversionService>;
  let subscanService: jest.Mocked<SubscanService>;
  let dataPlatformService: jest.Mocked<DataPlatformService>;

  beforeEach(() => {
    stakingRewardsService = {
      fetchStakingRewards: jest.fn<any>(),
    } as any;

    tokenPriceConversionService = {
      fetchQuotesForTokens: jest.fn<any>(),
    } as any;

    subscanService = {
      mapToSubstrateAccount: jest.fn<any>(),
    } as any;

    dataPlatformService = {
      fetchAggregatedStakingRewards: jest.fn<any>(),
    } as any;

    service = new StakingRewardsWithFiatService(
      stakingRewardsService,
      tokenPriceConversionService,
      subscanService,
      dataPlatformService,
    );
  });

  it("fetchStakingRewardsViaSubscan returns fiat-priced rewards", async () => {
    const mockRequest: StakingRewardsRequest = {
      chain: { domain: "polkadot", token: "DOT", label: "" },
      currency: "usd",
      address: "0x123abc",
      startDate: Date.now(),
    };

    // Simulate address mapping
    subscanService.mapToSubstrateAccount.mockResolvedValue("substrate123");

    const mockRewards: PricedStakingReward[] = [
      { amount: 10, timestamp: 1234567890 },
      { amount: 5, timestamp: 1234567891 },
    ];

    stakingRewardsService.fetchStakingRewards.mockResolvedValue(
      mockRewards as any,
    );

    tokenPriceConversionService.fetchQuotesForTokens.mockResolvedValue({
      polkadot: { price: 7.5 }, // 1 DOT = 7.5 USD
    } as any);

    const result = await service.fetchStakingRewardsViaSubscan(mockRequest);

    expect(subscanService.mapToSubstrateAccount).toHaveBeenCalledWith(
      "polkadot",
      "0x123abc",
    );
    expect(
      tokenPriceConversionService.fetchQuotesForTokens,
    ).toHaveBeenCalledWith(["polkadot"], "usd");
    expect(result).toEqual({
      values: [
        { amount: 10, timestamp: 1234567890, fiatValue: 75 },
        { amount: 5, timestamp: 1234567891, fiatValue: 37.5 },
      ],
      token: "DOT",
    });
  });
});
