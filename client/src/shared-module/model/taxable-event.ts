export interface TaxableEvent {
  id?: number;
  hash?: string;
  block?: number;
  timestamp: number;
  callModule?: string;
  callModuleFunction?: string;
  extrinsic_index?: string;
  tip?: number;
  feeUsed?: number;
  feeUsedFiat?: number;
  tipFiat?: number;
  xcmFee?: number;
  label?: string;
  isoDate?: string;
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
}
