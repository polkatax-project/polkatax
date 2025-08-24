import { FiscalYear, fiscalYearToBorders } from '../../model/fiscal-year';
import { TaxData } from '../../model/tax-data';

export const filterOnFiscalYear = (
  data: TaxData,
  fiscalYear: FiscalYear
): void => {
  const { start, end } = fiscalYearToBorders(fiscalYear);
  data.values = data.values.filter(
    (v) => v.isoDate! >= start && v.isoDate! <= end
  );
};
