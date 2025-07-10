import { Rewards, StakingRewardsPerYear } from '../model/rewards';

export const extractStakingRewardsPerYear = (
  rewards: Rewards | undefined,
  year: number
): StakingRewardsPerYear | undefined => {
  if (!rewards) {
    return undefined;
  }
  const beginningOfYearFormatted = `${year}-01-01`;
  const startNextYearFormatted = `${year + 1}-01-01`;
  return {
    ...rewards,
    year,
    dailyValues: Object.fromEntries(
      Object.entries(rewards.dailyValues).filter(
        ([key]) =>
          key >= beginningOfYearFormatted && key < startNextYearFormatted
      )
    ),
    values: rewards.values.filter(
      (v) =>
        v.isoDate >= beginningOfYearFormatted &&
        v.isoDate < startNextYearFormatted
    ),
    summary: rewards.summary.perYear.find((y) => y.year === year)!,
  };
};
