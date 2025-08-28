import { RewardsDto } from '../../model/rewards';
import { TaxData } from '../../model/tax-data';
import { formatDate } from '../../util/date-utils';

export const extractStakingRewards = (data: TaxData): RewardsDto => {
  const rewardsNested = data.values.filter(
    (v) => v.label === 'Staking reward' || v.label === 'Staking slashed'
  );
  const values: RewardDto[] = [];
  let token = '';
  rewardsNested.forEach((nested) => {
    token = nested.transfers[0].symbol;
    const squashed = nested.transfers.reduce(
      (next, curr) => ({
        amount: next.amount + curr.amount,
        fiatValue: next.fiatValue + (curr?.fiatValue ?? NaN),
        timestamp: nested.timestamp,
      }),
      {
        timestamp: 0,
        amount: 0,
        fiatValue: 0,
      }
    );

    values.push({
      ...squashed,
      timestamp: nested.timestamp,
      price: nested.transfers[0].price,
      isoDate: formatDate(nested.timestamp),
    });
  });
  return { token, values };
};

export interface RewardDto {
  timestamp: number;
  amount: number;
  nominationPool?: boolean;
  fiatValue?: number;
  price?: number;
  isoDate?: string;
}
