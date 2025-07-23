export interface XcmAssetTransfer {
  enum_key: string;
  asset_module: string;
  amount: string;
  history_currency_amount: string;
  current_currency_amount: string;
  decimals: number;
  symbol: string;
  asset_unique_id: string;
  network?: string;
  raw: any;
}

export interface RawXcmMessage {
  message_hash: string;
  id: string;
  origin_event_index: string;
  from_account_id: string;
  origin_para_id: number;
  origin_block_timestamp: number;
  relayed_block_timestamp: number;
  block_num: number;
  status: string;
  relayed_event_index: string;
  dest_event_index: string;
  dest_para_id: number;
  to_account_id: string;
  confirm_block_timestamp: number;
  extrinsic_index: string;
  relayed_extrinsic_index: string;
  dest_extrinsic_index: string;
  child_para_id: number;
  child_dest: string;
  protocol: string;
  message_type: string;
  from_chain: string;
  dest_chain: string;
  message_relay_chain: string;
  used_fee: string;
  s2s_dest_para_id?: number;
  s2s_origin_para_id?: number;
  assets: XcmAssetTransfer[];
  bridge_type: "s2e" | "e2s" | "s2s" | "";
}

export interface XcmTransfer {
  timestamp: number;
  block: number;
  fee: number;
  extrinsic_index?: string;
  transfers: {
    rawAmount?: string;
    symbol: string;
    amount: number;
    from: string;
    to: string;
    extrinsic_index?: string;
    price?: number;
    fiatValue?: number;
    fromChain?: string;
    destChain?: string;
    asset_unique_id;
  }[];
}
