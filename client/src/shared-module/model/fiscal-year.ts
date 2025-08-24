import { formatDate } from '../util/date-utils';

export type FiscalYear =
  | 'Jan 1 - Dec 31'
  | 'Apr 1 - Mar 31'
  | 'Jul 1 - Jun 30'
  | 'Oct 1 - Sep 30'
  | 'Mar 1 - Feb 28/29';

const toBorders = (borderDay: string): { start: string; end: string } => {
  const start = `${new Date().getFullYear() - 1}-${borderDay}`;
  const end = new Date(`${new Date().getFullYear()}-${borderDay}`);
  end.setDate(end.getDate() - 1);
  return { start, end: formatDate(end.getTime()) };
};

export const fiscalYearToBorders = (fiscalYear: FiscalYear) => {
  switch (fiscalYear) {
    case 'Jan 1 - Dec 31':
      return toBorders('01-01');
    case 'Apr 1 - Mar 31':
      return toBorders('04-01');
    case 'Jul 1 - Jun 30':
      return toBorders('07-01');
    case 'Oct 1 - Sep 30':
      return toBorders('10-01');
    case 'Mar 1 - Feb 28/29':
      return toBorders('03-01');
  }
};
