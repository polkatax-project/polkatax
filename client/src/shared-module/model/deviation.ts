export interface Deviation {
  symbol: string;
  unique_id: string;
  asset_id: number;
  diff: number;
  expectedDiff: number;
  deviation: number;
  absoluteDeviationTooLarge: boolean;
  perPaymentDeviationTooLarge: boolean;
  deviationPerPayment: number;
  numberTx: number;
  balanceBefore: number;
  balanceAfter: number;
}
