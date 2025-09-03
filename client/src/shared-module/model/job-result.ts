import { DailyRewards, RewardsDto, RewardSummary } from './rewards';
import { TaxData } from './tax-data';

export interface JobResult {
  wallet: string;
  syncUntilDate: number;
  currency: string;
  error?: any;
  data?: TaxData;
  lastModified: number;
  blockchain: string;
  status: string;
  syncFromDate: number;
  stakingRewards?: RewardsDto;
  stakingRewardsSummary?: RewardSummary;
  dailyStakingRewards?: DailyRewards;
}
