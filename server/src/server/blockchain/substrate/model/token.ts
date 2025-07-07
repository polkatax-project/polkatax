export interface Token {
  token_decimals: number;
  price: number;
}

export interface TokenInfo {
  name: string,
  symbol: string,
  decimals: number,
  currency_id: string, // often just the symbol
  token_id: any,
  unique_id: string,
  metadata: {
      symbol: string,
      decimals: number,
  }
}
