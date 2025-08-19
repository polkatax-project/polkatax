export interface Asset {
  id: string;
  asset_id: any;
  unique_id: string;
  symbol: string;
  name?: string;
  decimals: number;
  native?: boolean;
  currency_id?: string; // often just the symbol
  token_id?: string;
  price?: string;
}
