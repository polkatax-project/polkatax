import { Label } from "../../../common/model/label";
import { EventDetails } from "../../blockchain/substrate/model/subscan-event";

export type Provenance = "dataPlatformApi" | "deviationCompensation";

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
  fromAddressType?: "Exchange" | string;
  to: string;
  toAddressType?: "Exchange" | string;
  toAddressName?: string;
  fromAddressName?: string;
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
  semanticEventIndex?: string;
  label?: Label;
  hash?: string;
  xcmMessageHash?: string;
}
