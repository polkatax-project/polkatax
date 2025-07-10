import { JobResult } from '../../model/job-result';
import { Reward, Rewards } from '../../model/rewards';
import { calculateRewardSummary } from './calculate-reward-summary';
import { groupRewardsByDay } from './group-rewards-by-day';

export function sortJobs(jobs: JobResult[]) {
  return jobs.sort((a, b) => a.wallet.localeCompare(b.wallet));
}

export function sortRewards(rewards: Rewards) {
  rewards.values.sort((a, b) => a.timestamp - b.timestamp);
}

export function mapRawValuesToRewards(
  job: JobResult,
  tokenSymbol: string,
  rewards: Reward[]
): Rewards {
  const enriched = {
    values: rewards,
    summary: calculateRewardSummary(rewards),
    chain: job.blockchain,
    token: tokenSymbol,
    currency: job.currency,
    address: job.wallet,
    dailyValues: groupRewardsByDay(rewards),
  };
  sortRewards(enriched);
  return enriched;
}
