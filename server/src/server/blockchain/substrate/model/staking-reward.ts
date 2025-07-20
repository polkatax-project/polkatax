import { BigNumber } from "bignumber.js";

export interface RawStakingReward {
  event_id: "Reward" | "Slash";
  amount: BigNumber;
  timestamp: number;
  block: number;
  hash: string;
  event_index: string;
  extrinsic_index: string;
}

export interface StakingReward {
  amount: number;
  timestamp: number;
  block: number;
  hash: string;
  event_index: string;
  extrinsic_index: string;
  price?: number;
  fiatValue?: number;
  asset_unique_id: string;
}
