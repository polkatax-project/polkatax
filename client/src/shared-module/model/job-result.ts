import { DailyRewards, RewardsDto, RewardSummary } from './rewards';
import { TaxData } from './tax-data';

export interface JobResult {
  wallet: string;
  syncedUntil?: number;
  currency: string;
  error?: any;
  data?: TaxData;
  lastModified: number;
  blockchain: string;
  status: string;
  syncFromDate?: number;
  stakingRewards?: RewardsDto;
  stakingRewardsSummary?: RewardSummary;
  dailyStakingRewards?: DailyRewards;
}
