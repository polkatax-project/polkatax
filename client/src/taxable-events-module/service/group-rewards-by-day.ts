import { DailyRewards, RewardDto } from '../../shared-module/model/rewards';

export function groupRewardsByDay(rewards: RewardDto[]): DailyRewards {
  return rewards.reduce<{
    [key: string]: {
      amount: number;
      fiatValue: number | undefined;
    };
  }>((groupedByDay, reward) => {
    if (!groupedByDay[reward.isoDate!]) {
      groupedByDay[reward.isoDate!] = {
        amount: 0,
        fiatValue: 0,
      };
    }
    const todayValue = groupedByDay[reward.isoDate!];
    groupedByDay[reward.isoDate!].amount += reward.amount;
    groupedByDay[reward.isoDate!].fiatValue =
      todayValue.fiatValue !== undefined && reward.fiatValue !== undefined
        ? todayValue.fiatValue + reward.fiatValue
        : undefined;
    return groupedByDay;
  }, {});
}
