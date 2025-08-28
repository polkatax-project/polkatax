import { Parser } from '@json2csv/plainjs';
import { formatDateUTC } from '../util/date-utils';
import saveAs from 'file-saver';
import { Rewards } from '../model/rewards';

export const exportKoinlyCsv = (stakingRewards: Rewards) => {
  const parser = new Parser();
  const values = [...(stakingRewards.values || [])].map((v) => {
    return {
      'Koinly Date': formatDateUTC(v.timestamp),
      Amount: v.amount,
      Currency: stakingRewards.token,
      Label: v.amount > 0 ? 'Reward' : 'Cost',
    };
  });
  const csv = parser.parse(values);
  saveAs(
    new Blob([csv], { type: 'text/plain;charset=utf-8' }),
    `staking-rewards-koinly-${
      stakingRewards.chain
    }-${stakingRewards.address.substring(0, 5)}.csv`
  );
};
