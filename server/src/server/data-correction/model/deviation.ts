export interface Deviation {
  balanceBefore: number;
  balanceAfter: number;
  symbol: string;
  unique_id: string;
  decimals: number;
  asset_id: number;
  diff: number;
  expectedDiff: number;
  deviation: number;
  signedDeviation: number;
  absoluteDeviationTooLarge: boolean;
  singlePaymentDeviationTooLarge: boolean;
  numberTx: number;
  maxAllowedDeviation: number;
  maxDeviationSinglePayment: number;
  fees?: number;
  feesFiat?: number;
}
