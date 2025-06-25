import BigNumber from "bignumber.js";
import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { ForeignAsset } from "../../blockchain/substrate/model/foreign-asset";
import { Transfer } from "../../blockchain/substrate/model/raw-transfer";
import { EventDetails, SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { TokenInfo } from "../../blockchain/substrate/model/token";
import { mapPublicKeyToAddress } from "../../blockchain/substrate/util/map-public-key-to-address";
import { logger } from "../../logger/logger";
import isEqual from 'lodash.isequal';

export class SpecialEventsToTransfersService {
    eventHandlers: { chain: string, moduleId: string, eventId: string, handler: (chain: string, e: EventDetails, extra?: any) => Promise<Transfer | Transfer[]> }[] = [
        { chain: 'bifrost', moduleId: 'balances', eventId: 'Locked', handler: (c, e, extra) => this.onBifrostParachainBalancesLocked(e, extra) },
        { chain: 'bifrost', moduleId: 'balances', eventId: 'Unlocked', handler: (c, e, extra) => this.onBifrostParachainBalancesUnlocked(e, extra) },
        { chain: 'bifrost', moduleId: 'tokens', eventId: 'Withdrawn', handler: (c, e, extra) => this.onBifrostTokensWithdrawn(e, extra) },
        { chain: 'bifrost', moduleId: 'tokens', eventId: 'Deposited', handler: (c, e, extra) => this.onBifrostTokensDeposited(e, extra) },
        { chain: 'assethub-polkadot', moduleId: 'assetconversion', eventId: 'SwapExecuted', handler: (c, e, extra) => this.onAssethubSwapExecuted(e, extra) },
        { chain: 'assethub-polkadot', moduleId: 'assets', eventId: 'Issued', handler: (c, e, extra) => this.onAssethubAssetsIssued(e, extra) },
        { chain: 'hydration', moduleId: 'tokens', eventId: 'Deposited', handler: (c, e, extra) => this.onHydrationTokensDeposited(e, extra) },
        { chain: 'hydration', moduleId: 'balances', eventId: 'Locked', handler: (c, e, extra) => this.onHydrationBalancesLocked(e, extra) },
        { chain: 'hydration', moduleId: 'balances', eventId: 'Unlocked', handler: (c, e, extra) => this.onHydrationBalancesUnlocked(e, extra) }
    ]

    constructor(private subscanService: SubscanService) {
    }

    private findMatchingHandler(chain: string, ev: { module_id: string, event_id: string }) {
        return this.eventHandlers.find(h => chain === h.chain && h.moduleId === ev.module_id && h.eventId === ev.event_id )
    }

    async handleEvents(chain: string, events: SubscanEvent[]): Promise<Transfer[]> {
        const eventsOfInterest = events.filter(e => this.findMatchingHandler(chain, e))
        const eventDetails = await this.subscanService.fetchEventDetails(chain, eventsOfInterest)
        const token = await this.subscanService.fetchNativeToken(chain)
        let extra: any = undefined
        switch (chain) {
            case 'bifrost':
                extra = await this.subscanService.scanTokens(chain)
                extra.push({
                    decimals: token.token_decimals,
                    symbol: 'BNC',
                    token_id: { Native: "BNC" },
                    unique_id: 'BNC'
                })
                break;
            case 'hydration':
                extra = await this.subscanService.scanTokens(chain)
                extra.push({
                    decimals: token.token_decimals,
                    symbol: 'HDX',
                    token_id: { Native: "HDX" },
                    unique_id: 'HDX'
                })
                break;
            case 'assethub-polkadot':
                const foreignAssets = await this.subscanService.fetchForeignAssets(chain)
                const stdAssets = await this.subscanService.scanTokens(chain)
                stdAssets.push({
                    symbol: 'DOT',
                    decimals: token.token_decimals,
                    unique_id: 'DOT',
                    token_id: 'DOT'
                })
                extra = { foreignAssets, stdAssets }
        }
        return (await Promise.all(eventDetails.map(async details => {
            try {
                return await this.findMatchingHandler(chain, details).handler(chain, details, extra)
            } catch (error) {
                logger.error(`Error mapping event to transfer: ${details.extrinsic_index}, ${details.original_event_index}, ${details.module_id} ${details.event_id}`)
                return undefined
            }
        }))).flat().filter(t => !!t)
    }

    private async onBifrostTokensWithdrawn(event: EventDetails, tokens: TokenInfo[]): Promise<Transfer> {
        const key = event.params.find(p => p.name === "who")?.value;
        const address =  mapPublicKeyToAddress(key)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined)
        const currencyId =  event.params.find(p => p.name === "currency_id")?.value
        const token = tokens.find(t => isEqual(currencyId, t.token_id))
        if (!address || !amount || !token) {
            throw "Missing data"
        }
        return {
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: token.symbol,
            amount: amount / Math.pow(10, token.decimals),
            tokenId: token.unique_id,
            to: '',
            from: address,
        }
    }

    private async onBifrostTokensDeposited(event: EventDetails, tokens: TokenInfo[]): Promise<Transfer> {
        if (event.extrinsic_hash === "0xf7d6c93ef657e0fab4ac0b8225b5ade896bbbf928801b3c710b44477313bc3ea") {
            console.log("found it!")
        }
        const key = event.params.find(p => p.name === "who")?.value;
        const address =  mapPublicKeyToAddress(key)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined)
        const currencyId =  event.params.find(p => p.name === "currency_id")?.value
        const token = tokens.find(t => isEqual(currencyId, t.token_id))
        if (!address || !amount || !token) {
            throw "Missing data"
        }
        return {
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: token.symbol,
            amount: amount / Math.pow(10, token.decimals),
            tokenId: token.unique_id,
            to: address,
            from: '',
        }
    }

    private async onBifrostParachainBalancesUnlocked(event: EventDetails, tokens: TokenInfo[]): Promise<Transfer> {
        const key = event.params.find(p => p.name === "who")?.value;
        const address =  mapPublicKeyToAddress(key)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined)
        const token = tokens.find(t => t.symbol === "BNC")
        if (!address || !amount || !token) {
            throw "Missing data"
        }
        return {
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: token.symbol,
            amount: amount / Math.pow(10, token.decimals),
            tokenId: token.unique_id,
            to: '',
            from: address,
        }
    }

    private async onBifrostParachainBalancesLocked(event: EventDetails, tokens: TokenInfo[]): Promise<Transfer> {
        const key = event.params.find(p => p.name === "who")?.value;
        const address =  mapPublicKeyToAddress(key)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined)
        const token = tokens.find(t => t.symbol === "BNC")
        if (!address || !amount || !token) {
            throw "Missing data"
        }
        return {
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: token.symbol,
            amount: amount / Math.pow(10, token.decimals),
            tokenId: token.unique_id,
            to: address,
            from: '',
        }
    }

    private async onAssethubSwapExecuted(event: EventDetails, { foreignAssets, stdAssets }: any): Promise<Transfer[]> {
        const fromKey = event.params.find(p => p.name === "who")?.value;
        const toKey = event.params.find(p => p.name === "send_to")?.value;
        const from =  mapPublicKeyToAddress(fromKey)
        const to =  mapPublicKeyToAddress(toKey)

        const route: { col1: any, col2: any }[] =  event.params.find(p => p.name === "path")?.value
        const assets = route.map(r => r.col1).map(location => {
            if (location.interior?.Here === 'NULL') {
                return stdAssets.find(t => t.token_id === 'DOT')
            }
            const foreign = foreignAssets.find(t => isEqual(t.multi_location, location))
            if (foreign) {
                return {
                    symbol: foreign.metadata.symbol,
                    unique_id: foreign.unique_id,
                    token_id: foreign.asset_id,
                    decimals: foreign.metadata.decimals,
                }
            }
            return stdAssets.find(t => t.asset_id == location.interior?.X2[1]?.GeneralIndex)
        })
        const fromAsset = assets[0]
        const toAsset = assets[assets.length - 1]

        const amount_in = Number(event.params.find(p => p.name === "amount_in")?.value || undefined) / Math.pow(10, fromAsset.decimals)
        const amount_out = Number(event.params.find(p => p.name === "amount_out")?.value || undefined) / Math.pow(10, toAsset.decimals)

        if (!amount_in || !amount_out || !from || !to || !fromAsset || !toAsset) {
            throw "Missing data"
        }
        return [{
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: fromAsset.symbol,
            amount: amount_in,
            tokenId: fromAsset.unique_id,
            to: '',
            from,
        }, {
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: toAsset.symbol,
            amount: amount_out,
            tokenId: toAsset.unique_id,
            to,
            from: '',
        }]
    }

    private async onAssethubAssetsIssued(event: EventDetails, { stdAssets }: any): Promise<Transfer> {
        const ownerKey = event.params.find(p => p.name === "owner")?.value;
        const owner =  mapPublicKeyToAddress(ownerKey)
        const assetId = event.params.find(p => p.name === "asset_id")?.value;
        const asset = stdAssets.find(t => t.asset_id == assetId)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined) / Math.pow(10, asset.decimals)

        if (!owner || !asset || !amount) {
            throw "Missing data"
        }
        return {
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: asset.symbol,
            amount: amount,
            tokenId: asset.asset_id,
            to: owner,
            from: '',
        }
    }

    private async onHydrationTokensDeposited(event: EventDetails, tokens: TokenInfo[]): Promise<Transfer> {
        const key = event.params.find(p => p.name === "who")?.value;
        const address = mapPublicKeyToAddress(key)
        const currency_id = event.params.find(p => p.name === "currency_id")?.value;
        const asset = tokens.find(t => t.token_id == currency_id)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined) / Math.pow(10, asset.decimals)
        if (!address || !asset || !amount) {
            throw "Missing data"
        }
        return {
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: asset.symbol,
            amount: amount,
            tokenId: asset.unique_id,
            to: address,
            from: '',
        }
    }


    private async onHydrationBalancesLocked(event: EventDetails, tokens: TokenInfo[]): Promise<Transfer> {
        const key = event.params.find(p => p.name === "who")?.value;
        const address = mapPublicKeyToAddress(key)
        const token = tokens.find(t => t.symbol === "HDX")
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined) / Math.pow(10, token.decimals)
        if (!address || !token || !amount) {
            throw "Missing data"
        }
        return {
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: token.symbol,
            amount: amount,
            tokenId: token.unique_id,
            to: address,
            from: '',
        }
    }


    private async onHydrationBalancesUnlocked(event: EventDetails, tokens: TokenInfo[]): Promise<Transfer> {
        const key = event.params.find(p => p.name === "who")?.value;
        const address = mapPublicKeyToAddress(key)
        const token = tokens.find(t => t.symbol === "HDX")
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined) / Math.pow(10, token.decimals)
        if (!address || !token || !amount) {
            throw "Missing data"
        }
        return {
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: token.symbol,
            amount: amount,
            tokenId: token.unique_id,
            to: '',
            from: address,
        }
    }
}  