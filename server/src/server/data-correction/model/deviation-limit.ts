export interface DeviationLimit {
  symbol: string;
  singlePayment: number;
  max: number;
}

export const DEFAULT_DEVIATION_LIMIT = {
  singlePayment: 1,
  max: 3,
};
