import { RewardsDto } from '../../model/rewards';

export const filterOnLastYear = (rewardsDto: RewardsDto): void => {
  const beginningOfYearLastFormatted = `${new Date().getFullYear() - 1}-01-01`;
  const beginningOfYearThisFormatted = `${new Date().getFullYear()}-01-01`;
  rewardsDto.values = rewardsDto.values.filter((v) => v.isoDate! >= beginningOfYearLastFormatted && v.isoDate! < beginningOfYearThisFormatted);
};
