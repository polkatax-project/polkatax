interface TokenBalance { symbol: string, unique_id: string, decimals: number, balance: number, asset_id: string }

export interface AccountTokens { 
    timestamp: number, 
    native?: TokenBalance[], 
    builtin?: TokenBalance[],
    assets?: TokenBalance[]  
}