export interface Asset {
    asset_id: string,
    unique_id: string,
    metadata: {
        symbol: string,
        name?: string,
        decimals: number
    }
}
