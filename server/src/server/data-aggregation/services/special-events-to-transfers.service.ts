import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { ForeignAsset } from "../../blockchain/substrate/model/foreign-asset";
import { Transfer } from "../../blockchain/substrate/model/raw-transfer";
import { EventDetails, SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { TokenInfo } from "../../blockchain/substrate/model/token";
import { mapPublicKeyToAddress } from "../../blockchain/substrate/util/map-public-key-to-address";
import { logger } from "../../logger/logger";
import isEqual from 'lodash.isequal';
import { Asset } from "../../blockchain/substrate/model/asset";
import { isEvmAddress } from "../../data-aggregation/helper/is-evm-address";
import { getAddress } from 'ethers';

interface EventDerivedTransfer extends Transfer {
    event_id: string,
    module_id: string,
    original_event_id: string
}

interface AssetInfos {
 tokens: TokenInfo[], stdAssets: Asset[], foreignAssets: ForeignAsset[]
}

const mapKeyToCanonicalAddress = (key: string) => {
    if (isEvmAddress(key)) {
        return getAddress(key)
    }
    return mapPublicKeyToAddress(key)
}

export class SpecialEventsToTransfersService {
    eventHandlers: { chain, moduleId: string, eventId: string, handler: (chain: { domain: string, token: string }, e: EventDetails, assets: AssetInfos) => Promise<EventDerivedTransfer | EventDerivedTransfer[]> }[] = [
        { chain: 'bifrost', moduleId: 'balances', eventId: 'Locked', handler: (c, e, assets) => this.onBifrostParachainBalancesLocked(e, assets) },
        { chain: 'bifrost', moduleId: 'balances', eventId: 'Unlocked', handler: (c, e, assets) => this.onBifrostParachainBalancesUnlocked(e, assets) },
        { chain: 'bifrost', moduleId: 'tokens', eventId: 'Withdrawn', handler: (c, e, assets) => this.onBifrostTokensWithdrawn(e, assets) },
        { chain: 'bifrost', moduleId: 'tokens', eventId: 'Deposited', handler: (c, e, assets) => this.onBifrostTokensDeposited(e, assets) },
        { chain: 'assethub-polkadot', moduleId: 'assetconversion', eventId: 'SwapExecuted', handler: (c, e, assets) => this.onAssethubSwapExecuted(e, assets) },
        { chain: 'assethub-polkadot', moduleId: 'assets', eventId: 'Issued', handler: (c, e, assets) => this.onAssethubAssetsIssued(e, assets) },
        //{ chain: 'hydration', moduleId: 'tokens', eventId: 'Deposited', handler: (c, e, extra) => this.onHydrationTokensDeposited(e, extra) },
        { chain: 'hydration', moduleId: 'currencies', eventId: 'Deposited', handler: (c, e, assets) => this.onHydrationTokensDeposited(e, assets) },
        { chain: 'hydration', moduleId: 'currencies', eventId: 'Minted', handler: (c, e, assets) => this.onHydrationTokensDeposited(e, assets) },
        { chain: 'hydration', moduleId: 'balances', eventId: 'Locked', handler: (c, e, assets) => this.onBalancesLocked(c, e, assets) },
        { chain: 'hydration', moduleId: 'balances', eventId: 'Unlocked', handler: (c, e, assets) => this.onBalancesUnlocked(c, e, assets) },
        { chain: 'acala', moduleId: 'balances', eventId: 'Locked', handler: (c, e, assets) => this.onBalancesLocked(c, e, assets) },
        { chain: 'acala', moduleId: 'balances', eventId: 'Unlocked', handler: (c, e, assets) => this.onBalancesUnlocked(c, e, assets) },
        { chain: 'astar', moduleId: 'balances', eventId: 'Locked', handler: (c, e, assets) => this.onBalancesLocked(c, e, assets) },
        { chain: 'astar', moduleId: 'balances', eventId: 'Unlocked', handler: (c, e, assets) => this.onBalancesUnlocked(c, e, assets) },
        { chain: 'astar', moduleId: 'balances', eventId: 'Thawed', handler: (c, e, assets) => this.onBalancesUnlocked(c, e, assets) },
        { chain: 'astar', moduleId: 'balances', eventId: 'Frozen', handler: (c, e, assets) => this.onBalancesLocked(c, e, assets) },
        { chain: 'mythos', moduleId: 'balances', eventId: 'Frozen', handler: (c, e, assets) => this.onBalancesLocked(c, e, assets) },
        { chain: 'mythos', moduleId: 'balances', eventId: 'Thawed', handler: (c, e, assets) => this.onBalancesUnlocked(c, e, assets) },
        { chain: 'peaq', moduleId: 'assets', eventId: 'Burned', handler: (c, e, assets) => this.onPeaqBalancesBurned(e, assets) },
        { chain: 'peaq', moduleId: 'assets', eventId: 'Issued', handler: (c, e, assets) => this.onPeaqBalancesIssued(e, assets) },
    ]

    constructor(private subscanService: SubscanService) {
    }

    private findMatchingHandler(chain: string, ev: { module_id: string, event_id: string }) {
        return this.eventHandlers.find(h => chain === h.chain && h.moduleId === ev.module_id && h.eventId === ev.event_id )
    }

    private async fetchTokens(chainInfo: { token: string, domain: string}): Promise<AssetInfos> {
        const token = await this.subscanService.fetchNativeToken(chainInfo.domain)
        let extra: { tokens: TokenInfo[], stdAssets: Asset[], foreignAssets: ForeignAsset[] } = {
            tokens: [], stdAssets: [], foreignAssets: []
        }
        switch (chainInfo.domain) {
            case 'assethub-polkadot':
            case 'assethub-kusama':
                const foreignAssets = await this.subscanService.fetchForeignAssets(chainInfo.domain)
                const stdAssets = await this.subscanService.scanAssets(chainInfo.domain)
                stdAssets.push({
                    metadata: {
                        symbol: chainInfo.token,
                        decimals: token.token_decimals,
                    },
                    unique_id: chainInfo.token,
                    asset_id: chainInfo.token
                })
                extra = { foreignAssets, stdAssets, tokens: [] }
                break;
            case 'peaq':
                const assets = await this.subscanService.scanAssets(chainInfo.domain)
                assets.push({
                    metadata: {
                        symbol: chainInfo.token,
                        decimals: token.token_decimals,
                    },
                    unique_id: chainInfo.token,
                    asset_id: chainInfo.token
                })
                extra = { foreignAssets: [], stdAssets: assets, tokens: [] }
                break;
            case 'bifrost':
            case 'hydration':
            case 'acala':
            case 'astar':
            case 'mythos':
                extra.tokens = await this.subscanService.scanTokens(chainInfo.domain)
                extra.tokens.push({
                    name: chainInfo.token,
                    decimals: token.token_decimals,
                    symbol: chainInfo.token,
                    token_id: { Native: chainInfo.token },
                    unique_id: chainInfo.token,
                    currency_id: chainInfo.token,
                    metadata: {
                        decimals: token.token_decimals,
                        symbol: chainInfo.token
                    }
                })
        }
        return extra
    }

    async handleEvents(chainInfo: { token: string, domain: string}, events: SubscanEvent[]): Promise<EventDerivedTransfer[]> {
        const eventsOfInterest = events.filter(e => this.findMatchingHandler(chainInfo.domain, e))
        const eventDetails = await this.subscanService.fetchEventDetails(chainInfo.domain, eventsOfInterest)
        const extras = await this.fetchTokens(chainInfo)
        const transfersFromEvents = (await Promise.all(eventDetails.map(async details => {
            try {
                return await this.findMatchingHandler(chainInfo.domain, details).handler(chainInfo, details, extras)
            } catch (error) {
                logger.error(`Error mapping event to transfer: ${details.extrinsic_index}, ${details.original_event_index}, ${details.module_id} ${details.event_id}`)
                logger.error(error)
                return undefined
            }
        }))).flat().filter(t => !!t)

        // smart filter
        const groupedTransfers: Record<string, [EventDerivedTransfer]> = {}
        transfersFromEvents.forEach(t => {
            if (!groupedTransfers[t.extrinsic_index]) {
                groupedTransfers[t.extrinsic_index] = [t]
            } else {
                groupedTransfers[t.extrinsic_index].push(t)
            }
        }) 
        const gatheredTransfers = Object.values(groupedTransfers).flat()
        return gatheredTransfers
    }

    private async onBifrostTokensWithdrawn(event: EventDetails, { tokens } : { tokens: TokenInfo[] }): Promise<EventDerivedTransfer> {
        const key = event.params.find(p => p.name === "who")?.value;
        const address =  mapKeyToCanonicalAddress(key)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined)
        const currencyId =  event.params.find(p => p.name === "currency_id")?.value
        const token = tokens.find(t => isEqual(currencyId, t.token_id))
        if (!address || !amount || !token) {
            throw "Missing data"
        }
        return {
            event_id: event.event_id,
            module_id: event.module_id,
            original_event_id: event.original_event_index,
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

    private async onBifrostTokensDeposited(event: EventDetails, { tokens } : { tokens: TokenInfo[] }): Promise<EventDerivedTransfer> {
        if (event.extrinsic_hash === "0xf7d6c93ef657e0fab4ac0b8225b5ade896bbbf928801b3c710b44477313bc3ea") {
            console.log("found it!")
        }
        const key = event.params.find(p => p.name === "who")?.value;
        const address =  mapKeyToCanonicalAddress(key)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined)
        const currencyId =  event.params.find(p => p.name === "currency_id")?.value
        const token = tokens.find(t => isEqual(currencyId, t.token_id))
        if (!address || !amount || !token) {
            throw "Missing data"
        }
        return {
            event_id: event.event_id,
            module_id: event.module_id,
            original_event_id: event.original_event_index,
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

    private async onBifrostParachainBalancesUnlocked(event: EventDetails, { tokens } : { tokens: TokenInfo[] }): Promise<EventDerivedTransfer> {
        const key = event.params.find(p => p.name === "who")?.value;
        const address =  mapKeyToCanonicalAddress(key)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined)
        const token = tokens.find(t => t.symbol === "BNC")
        if (!address || !amount || !token) {
            throw "Missing data"
        }
        return {
            event_id: event.event_id,
            module_id: event.module_id,
            original_event_id: event.original_event_index,
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

    private async onBifrostParachainBalancesLocked(event: EventDetails, { tokens } : { tokens: TokenInfo[] }): Promise<EventDerivedTransfer> {
        const key = event.params.find(p => p.name === "who")?.value;
        const address =  mapKeyToCanonicalAddress(key)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined)
        const token = tokens.find(t => t.symbol === "BNC")
        if (!address || !amount || !token) {
            throw "Missing data"
        }
        return {
            event_id: event.event_id,
            module_id: event.module_id,
            original_event_id: event.original_event_index,
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

    private async onAssethubSwapExecuted(event: EventDetails, { foreignAssets, stdAssets }: { foreignAssets: ForeignAsset[], stdAssets: Asset[] }): Promise<EventDerivedTransfer[]> {
        const fromKey = event.params.find(p => p.name === "who")?.value;
        const toKey = event.params.find(p => p.name === "send_to")?.value;
        const from =  mapKeyToCanonicalAddress(fromKey)
        const to =  mapKeyToCanonicalAddress(toKey)

        const route: { col1: any, col2: any }[] =  event.params.find(p => p.name === "path")?.value
        const assets = route.map(r => r.col1).map(location => {
            if (location.interior?.Here === 'NULL') {
                return stdAssets.find(t => t.metadata.symbol === 'DOT')
            }
            const foreign = foreignAssets.find(t => isEqual(t.multi_location, location))
            if (foreign) {
                foreign
            }
            return stdAssets.find(t => t.asset_id == location.interior?.X2[1]?.GeneralIndex)
        })
        const fromAsset = assets[0]
        const toAsset = assets[assets.length - 1]

        const amount_in = Number(event.params.find(p => p.name === "amount_in")?.value || undefined) / Math.pow(10, fromAsset?.metadata?.decimals)
        const amount_out = Number(event.params.find(p => p.name === "amount_out")?.value || undefined) / Math.pow(10, toAsset?.metadata?.decimals)

        if (!amount_in || !amount_out || !from || !to || !fromAsset || !toAsset) {
            throw "Missing data"
        }
        return [{
            event_id: event.event_id,
            module_id: event.module_id,
            original_event_id: event.original_event_index,
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: fromAsset.metadata.symbol,
            amount: amount_in,
            tokenId: fromAsset.unique_id,
            to: '',
            from,
        }, {
            event_id: event.event_id,
            module_id: event.module_id,
            original_event_id: event.original_event_index,
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: toAsset.metadata.symbol,
            amount: amount_out,
            tokenId: toAsset.unique_id,
            to,
            from: '',
        }]
    }

    private async onAssethubAssetsIssued(event: EventDetails,  { stdAssets }: { stdAssets: Asset[] }): Promise<EventDerivedTransfer> {
        const ownerKey = event.params.find(p => p.name === "owner")?.value;
        const owner =  mapKeyToCanonicalAddress(ownerKey)
        const assetId = event.params.find(p => p.name === "asset_id")?.value;
        const asset = stdAssets.find(t => t.asset_id == assetId)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined) / Math.pow(10, asset?.metadata?.decimals)

        if (!owner || !asset || !amount) {
            throw "Missing data"
        }
        return {
            event_id: event.event_id,
            module_id: event.module_id,
            original_event_id: event.original_event_index,
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: asset?.metadata?.symbol,
            amount: amount,
            tokenId: asset.asset_id,
            to: owner,
            from: '',
        }
    }

    private async onHydrationTokensDeposited(event: EventDetails,  { tokens } : { tokens: TokenInfo[] }): Promise<EventDerivedTransfer> {
        const key = event.params.find(p => p.name === "who")?.value;
        const address = mapKeyToCanonicalAddress(key)
        const currency_id = event.params.find(p => p.name === "currency_id")?.value;
        const asset = tokens.find(t => t.token_id == currency_id)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined) / Math.pow(10, asset?.metadata?.decimals)
        if (!address || !asset || !amount) {
            throw "Missing data"
        }
        return {
            event_id: event.event_id,
            module_id: event.module_id,
            original_event_id: event.original_event_index,
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

    private async onBalancesLocked({ token }: { token: string }, event: EventDetails,  { tokens } : { tokens: TokenInfo[] }): Promise<EventDerivedTransfer> {
        const key = event.params.find(p => p.name === "who")?.value;
        const address = mapKeyToCanonicalAddress(key)
        const tokenInfo = tokens.find(t => t.symbol === token)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined) / Math.pow(10, tokenInfo?.metadata?.decimals)
        if (!address || !tokenInfo || !amount) {
            throw "Missing data"
        }
        return {
            event_id: event.event_id,
            module_id: event.module_id,
            original_event_id: event.original_event_index,
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: tokenInfo.symbol,
            amount: amount,
            tokenId: tokenInfo.unique_id,
            to: address,
            from: '',
        }
    }

    private async onBalancesUnlocked({ token }: { token: string }, event: EventDetails, { tokens } : { tokens: TokenInfo[] }): Promise<EventDerivedTransfer> {
        const key = event.params.find(p => p.name === "who")?.value;
        const address = mapKeyToCanonicalAddress(key)
        const tokenInfo = tokens.find(t => t.symbol === token)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined) / Math.pow(10, tokenInfo?.metadata?.decimals)
        if (!address || !tokenInfo || !amount) {
            throw "Missing data"
        }
        return {
            event_id: event.event_id,
            module_id: event.module_id,
            original_event_id: event.original_event_index,
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: tokenInfo.symbol,
            amount: amount,
            tokenId: tokenInfo.unique_id,
            to: '',
            from: address,
        }
    }

    private async onPeaqBalancesBurned(event: EventDetails, { stdAssets }: { stdAssets: Asset[] }): Promise<EventDerivedTransfer> {
        const key = event.params.find(p => p.name === "owner")?.value;
        const address = mapKeyToCanonicalAddress(key)
        const asset_id = event.params.find(p => p.name === "asset_id")?.value;
        const asset = stdAssets.find(t => t.asset_id == asset_id)
        const amount = Number(event.params.find(p => p.name === "balance")?.value || undefined) / Math.pow(10, asset?.metadata?.decimals)
        if (!address || !asset || !amount) {
            throw "Missing data"
        }
        return {
            event_id: event.event_id,
            module_id: event.module_id,
            original_event_id: event.original_event_index,
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: asset.metadata.symbol,
            amount: amount,
            tokenId: asset.unique_id,
            to: '',
            from: address,
        }
    }

    private async onPeaqBalancesIssued(event: EventDetails, { stdAssets }: { stdAssets: Asset[] }): Promise<EventDerivedTransfer> {
        const key = event.params.find(p => p.name === "owner")?.value;
        const address = mapKeyToCanonicalAddress(key)
        const asset_id = event.params.find(p => p.name === "asset_id")?.value;
        const asset = stdAssets.find(t => t.asset_id == asset_id)
        const amount = Number(event.params.find(p => p.name === "amount")?.value || undefined) / Math.pow(10, asset?.metadata?.decimals)
        if (!address || !asset || !amount) {
            throw "Missing data"
        }
        return {
            event_id: event.event_id,
            module_id: event.module_id,
            original_event_id: event.original_event_index,
            block: event.block_num,
            hash: event.extrinsic_hash,
            extrinsic_index: event.extrinsic_index,
            timestamp: event.timestamp!,
            symbol: asset.metadata.symbol,
            amount: amount,
            tokenId: asset.unique_id,
            to: address,
            from: '',
        }
    }
}  