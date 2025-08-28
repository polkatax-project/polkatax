import { Parser } from '@json2csv/plainjs';
import { formatDateUTC } from '../util/date-utils';
import saveAs from 'file-saver';
import { RewardDto, Rewards } from '../model/rewards';

interface RewardsTableHeader extends RewardDto {
  'Reward token': string;
  Chain: string;
  Currency: string;
  'Wallet address': string;
  totalAmount: number;
  totalValue: number;
  utcDate: string;
}

export const exportDefaultCsv = (rewards: Rewards) => {
  const parser = new Parser();
  const values: RewardDto[] = [...(rewards.values || [])].map((v) => {
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
    `staking-rewards-${rewards.chain}-${rewards.address.substring(0, 5)}.csv`
  );
};
