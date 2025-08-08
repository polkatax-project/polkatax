import { StakingRewardsWithFiatService } from './staking-rewards-with-fiat.service';
import { StakingRewardsService } from '../../blockchain/substrate/services/staking-rewards.service';
import { TokenPriceConversionService } from './token-price-conversion.service';
import { SubscanService } from '../../blockchain/substrate/api/subscan.service';
import { DataPlatformService } from '../../data-platform-api/data-platform.service';
import { expect, it, jest, describe, beforeEach, afterEach } from "@jest/globals";
import { StakingRewardsRequest } from '../model/staking-rewards.request';
import { StakingReward } from '../../blockchain/substrate/model/staking-reward';
import { AggregatedStakingReward } from '../model/aggregated-staking-reward';

jest.mock('../helper/add-fiat-values-to-staking-rewards', () => ({
  addFiatValuesToAggregatedStakingRewards: jest.fn((rewards, quote) => rewards),
  addFiatValuesToStakingRewards: jest.fn(),
}));

jest.mock('../helper/find-coingecko-id-for-native-token', () => ({
  findCoingeckoIdForNativeToken: jest.fn(() => 'coingecko-dot'),
}));

jest.mock('../helper/is-evm-address', () => ({
  isEvmAddress: jest.fn(() => false),
}));

describe('StakingRewardsWithFiatService', () => {
  let service: StakingRewardsWithFiatService;
  let stakingRewardsService: jest.Mocked<StakingRewardsService>;
  let tokenPriceConversionService: jest.Mocked<TokenPriceConversionService>;
  let subscanService: jest.Mocked<SubscanService>;
  let dataPlatformService: jest.Mocked<DataPlatformService>;

  const dummyRequest: StakingRewardsRequest = {
    address: 'addr',
    chain: { domain: 'polkadot' } as any,
    currency: 'USD',
    minDate: 0,
  };

  beforeEach(() => {
    stakingRewardsService = {
      fetchStakingRewards: jest.fn(),
    } as any;

    tokenPriceConversionService = {
      fetchQuotesForTokens: jest.fn(),
    } as any;

    subscanService = {
      mapToSubstrateAccount: jest.fn(),
    } as any;

    dataPlatformService = {
      fetchAggregatedStakingRewardsForChain: jest.fn(),
    } as any;

    service = new StakingRewardsWithFiatService(
      stakingRewardsService,
      tokenPriceConversionService,
      subscanService,
      dataPlatformService,
    );
  });

  afterEach(() => {
    delete process.env.USE_DATA_PLATFORM_API;
    jest.clearAllMocks();
  });

  it('uses data platform when USE_DATA_PLATFORM_API is set and chain is polkadot', async () => {
    process.env.USE_DATA_PLATFORM_API = '1';

    const rewards: AggregatedStakingReward[] = [
      { timestamp: 1, rewards: [] } as any,
    ];
    dataPlatformService.fetchAggregatedStakingRewardsForChain.mockResolvedValue(
      rewards,
    );
    tokenPriceConversionService.fetchQuotesForTokens.mockResolvedValue({
      'coingecko-dot': { price: 10 } as any,
    });

    const result = await service.fetchStakingRewards(dummyRequest);

    expect(
      dataPlatformService.fetchAggregatedStakingRewardsForChain,
    ).toHaveBeenCalledWith('addr', 'polkadot');
    expect(result.rawStakingRewards).toEqual([]);
    expect(result.aggregatedRewards).toEqual(rewards);
  });

  it('fetches from Subscan when USE_DATA_PLATFORM_API is not set', async () => {
    const rawRewards: StakingReward[] = [{ amount: 1 } as any];
    stakingRewardsService.fetchStakingRewards.mockResolvedValue(rawRewards);
    tokenPriceConversionService.fetchQuotesForTokens.mockResolvedValue({
      'coingecko-dot': { price: 100 },
    } as any);

    const result = await service.fetchStakingRewards(dummyRequest);

    expect(stakingRewardsService.fetchStakingRewards).toHaveBeenCalledWith({
      chainName: 'polkadot',
      address: 'addr',
      minDate: 0,
    });
    expect(result.rawStakingRewards).toEqual(rawRewards);
    expect(result.aggregatedRewards).toEqual([]);
  });

  it('fetches from Subscan for non-platform chains regardless of env', async () => {
    process.env.USE_DATA_PLATFORM_API = '1';
    const request: StakingRewardsRequest = {
      ...dummyRequest,
      chain: { domain: 'some-other-chain' } as any,
    };

    const rawRewards: StakingReward[] = [{ amount: 5 } as any];
    stakingRewardsService.fetchStakingRewards.mockResolvedValue(rawRewards);
    tokenPriceConversionService.fetchQuotesForTokens.mockResolvedValue({
      'coingecko-dot': { price: 50 },
    } as any);

    const result = await service.fetchStakingRewards(request);

    expect(stakingRewardsService.fetchStakingRewards).toHaveBeenCalled();
    expect(result.rawStakingRewards).toEqual(rawRewards);
    expect(result.aggregatedRewards).toEqual([]);
  });
});