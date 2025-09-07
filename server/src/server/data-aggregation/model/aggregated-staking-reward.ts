import { Label } from "../../../common/model/label";
import { Provenance } from "./portfolio-movement";

export interface AggregatedStakingReward {
  timestamp: number;
  label?: Label;
  provenance?: Provenance;
  block?: number;
  extrinsic_index?: string;
  transfers: {
    symbol: string;
    amount: number;
    to: string;
    price?: number;
    fiatValue?: number;
    asset_unique_id?: string;
  }[];
}
