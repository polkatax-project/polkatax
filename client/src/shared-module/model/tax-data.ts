import { TaxableEvent } from './taxable-event';

export interface TaxData {
  chain: string;
  address: string;
  currency: string;
  values: TaxableEvent[];
}
