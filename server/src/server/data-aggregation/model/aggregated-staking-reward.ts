import { Label, Provenance } from "./portfolio-movement";

export interface AggregatedStakingReward {
  timestamp: number;
  isoDate: string;
  label?: Label;
  provenance?: Provenance;
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
