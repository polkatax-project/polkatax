import { Deviation } from './deviation';
import { TaxableEvent } from './taxable-event';

export interface TaxData {
  chain: string;
  address: string;
  currency: string;
  values: TaxableEvent[];
  deviations: Deviation[];
  fromDate: string;
  toDate: string;
  fiscalYearIncomplete: boolean;
}
