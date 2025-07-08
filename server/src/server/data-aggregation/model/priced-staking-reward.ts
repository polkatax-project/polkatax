export interface PricedStakingReward {
  amount: number;
  timestamp: number;
  price?: number;
  fiatValue?: number;
  nominationPool?: boolean;
}
