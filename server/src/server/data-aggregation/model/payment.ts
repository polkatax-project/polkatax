export interface Payment {
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
  events: { moduleId: string; eventId: string }[];
  label?: string;
  provenance?: string;
  transfers: {
    symbol: string;
    tokenId: string;
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
  }[];
}
