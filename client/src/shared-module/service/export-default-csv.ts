import { Parser } from '@json2csv/plainjs';
import { Reward, StakingRewardsPerYear } from '../model/rewards';
import { formatDateUTC } from '../util/date-utils';
import saveAs from 'file-saver';

interface RewardsTableHeader extends Reward {
  'Reward token': string;
  Chain: string;
  Currency: string;
  'Wallet address': string;
  totalAmount: number;
  totalValue: number;
  totalValueNow: number;
  utcDate: string;
}

export const exportDefaultCsv = (rewards: StakingRewardsPerYear) => {
  const parser = new Parser();
  const values = [...(rewards.values || [])].map((v) => {
    return {
      ...v,
      nominationPool: v.nominationPool || false,
      utcDate: formatDateUTC(v.timestamp),
    };
  });
  values[0] = {
    'Reward token': rewards.token,
    Chain: rewards.chain,
    Currency: rewards.currency,
    'Wallet address': rewards.address,
    ...values[0],
    totalAmount: rewards.summary.amount,
    totalValue: rewards.summary.fiatValue,
    nominationPool: undefined,
  } as RewardsTableHeader;
  const csv = parser.parse(values);
  saveAs(
    new Blob([csv], { type: 'text/plain;charset=utf-8' }),
    `staking-rewards-${rewards.chain}-${rewards.address.substring(0, 5)}_${
      rewards.year
    }.csv`
  );
};
