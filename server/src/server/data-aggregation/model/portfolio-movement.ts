import { AggregatedStakingReward } from "./aggregated-staking-reward";

export type Provenance =
  | "xcm"
  | "transfer"
  | "event"
  | "stakingRewards"
  | "tx"
  | "aggregatedData";

export type Label =
  | "EVM Transaction"
  | "Farming deposit"
  | "Farming withdraw"
  | "Liquidity removed"
  | "Liquidity added"
  | "Swap"
  | "Crowdloan contribution"
  | "Liquid staking token minted"
  | "Liquid staking token redeemed"
  | "XCM transfer"
  | "Treasury grant"
  | "Reward"
  | "Staking reward"
  | "Staking slashed"
  | "Coretime purchase"
  | "Remove from Pool"
  | "Migrated delegation"
  | "Reserve repatriated";

export interface PortfolioMovement {
  hash?: string;
  block?: number;
  timestamp: number;
  callModule?: string;
  callModuleFunction?: string;
  extrinsic_index: string;
  tip?: number;
  feeUsed?: number;
  feeUsedFiat?: number;
  tipFiat?: number;
  xcmFee?: number;
  events: { moduleId: string; eventId: string; eventIndex: string }[];
  label?: Label;
  provenance?: Provenance;
  transfers: {
    symbol: string;
    amount: number;
    from: string;
    to: string;
    extrinsic_index?: string;
    price?: number;
    fiatValue?: number;
    coingeckoId?: string;
    module?: string;
    fromChain?: string;
    toChain?: string;
    asset_type?: string;
    asset_unique_id?: string;
  }[];
}

export type TaxableEvent = PortfolioMovement | AggregatedStakingReward;
