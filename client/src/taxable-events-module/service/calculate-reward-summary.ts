import { RewardDto, RewardSummary } from '../../shared-module/model/rewards';

export const calculateRewardSummary = (rewards: RewardDto[]): RewardSummary => {
  const accumulatedRewards = rewards.reduce<{
    amount: number;
    fiatValue?: number;
  }>(
    (acc, reward) => {
      return {
        amount: acc.amount + reward.amount,
        fiatValue:
          acc.fiatValue === undefined || reward.fiatValue === undefined
            ? undefined
            : acc.fiatValue + reward.fiatValue,
      };
    },
    { amount: 0, fiatValue: 0 }
  );
  return accumulatedRewards;
};
