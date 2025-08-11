import { TaxableData } from '../../model/rewards';

export const filterOnLastYear = (data: TaxableData): void => {
  const beginningOfYearLastFormatted = `${new Date().getFullYear() - 1}-01-01`;
  const beginningOfYearThisFormatted = `${new Date().getFullYear()}-01-01`;
  data.values = data.values.filter(
    (v) =>
      v.isoDate! >= beginningOfYearLastFormatted &&
      v.isoDate! < beginningOfYearThisFormatted
  );
};
