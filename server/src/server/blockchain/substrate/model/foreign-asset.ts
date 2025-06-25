export interface ForeignAsset {
    asset_id: string,
    unique_id: string,
    metadata: {
        symbol: string,
        decimals: number
    },
    multi_location: {
        parents: number,
        interior: any
    }
}