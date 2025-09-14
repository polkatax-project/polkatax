import { Label } from "../../../common/model/label";

export type Provenance =
  | "xcm"
  | "transfer"
  | "event"
  | "stakingRewards"
  | "tx"
  | "aggregatedData"
  | "dataPlatformApi"
  | "deviationCompensation";

export interface PortfolioMovement {
  hash?: string;
  block?: number;
  timestamp: number;
  callModule?: string;
  callModuleFunction?: string;
  extrinsic_index: string;
  tip?: number;
  feeUsed?: number;
  feeTokenSymbol?: string;
  feeTokenUniqueId?: string;
  feeUsedFiat?: number;
  tipFiat?: number;
  xcmFee?: number;
  xcmFeeTokenSymbol?: string;
  xcmFeeFiat?: number;
  xcmFeeTokenUniqueId?: string;
  events: { moduleId: string; eventId: string; eventIndex: string }[];
  label?: Label;
  provenance?: Provenance;
  transfers: TaxableEventTransfer[];
}

export interface TaxableEventTransfer {
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
  event_index?: string;
  semanticGroupId?: string;
  label?: Label;
}
