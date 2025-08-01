export interface AggregatedStakingReward {
  timestamp: number;
  label?: string;
  provenance?: string;
  transfers: {
    symbol: string;
    amount: number;
    to: string;
    price?: number;
    fiatValue?: number;
    asset_unique_id?: string;
    nominationPool?: boolean;
  }[];
}
