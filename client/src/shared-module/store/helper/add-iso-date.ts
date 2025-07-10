import { Reward, RewardDto } from '../../model/rewards';
import { formatDate } from '../../util/date-utils';

export const addIsoDate = (values: RewardDto[]): Reward[] => {
  return values.map((v) => ({
    ...v,
    /**
     * Using the isoDate set by server is important here.
     * Using the platform api comes with an isoDate set.
     * Working with timestamps in different time zones might truncate aggregated data.
     */
    isoDate: v.isoDate ?? formatDate(v.timestamp),
  }));
};
