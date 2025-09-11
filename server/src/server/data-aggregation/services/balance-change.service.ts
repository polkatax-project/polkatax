import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { Asset } from "../../blockchain/substrate/model/asset";
import { MultiLocation } from "../../blockchain/substrate/model/multi-location";
import { EventDetails, SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { logger } from "../../logger/logger";
import { PortfolioMovement } from "../model/portfolio-movement";
import { extractAddress, getPropertyValue } from "./special-event-processing/helper";
import isEqual from "lodash.isequal";

type TokenBalanceChange = Record<string, TokenBalanceChangeRecord>
type TokenBalanceChangeRecord = Record<string, TokenBalanceChangeValue>
type TokenBalanceChangeValue = { amount: number, extrinsic_index: string, block: number, symbol: string, timestamp: number, decimals: number }

export interface BalanceChange { extrinsic_index, block, timestamp, assets: { amount, asset_unique_id, symbol, decimals }[] }

export class BalancesChangesService {

    constructor(private subscanService: SubscanService) {}

    async fetchAllBalanceChanges(chain: { domain: string, token: string }, address: string, subscanEvents: SubscanEvent[]): Promise<PortfolioMovement[[]> {
        logger.info(`Entry fetchAllBalanceChanges for ${chain.domain} and ${address}. SubscanEvents: ${subscanEvents.length}`)
        const [balanceMovements, assetMovements, foreigAssetMovements, tokenMovements] = await Promise.all([
            this.fetchBalanceMovements(chain, address, subscanEvents),
            this.fetchAssetMovements(chain, address, subscanEvents),
            this.fetchForeignAssetMovements(chain, address, subscanEvents),
            this.fetchTokenMovements(chain, address, subscanEvents),
        ])
        const movements: Record<string, { extrinsic_index, block, timestamp, assets: { amount, asset_unique_id, symbol, decimals: number }[] }> = {};
        for (const changes of [balanceMovements, assetMovements, foreigAssetMovements, tokenMovements]) {
            Object.entries(changes).forEach(([_, value]) => {
                Object.entries(value).forEach(([asset_unique_id, values]) => {
                    const key = values.extrinsic_index ?? values.block ?? values.timestamp
                    movements[key] = movements[key] ?? {
                        extrinsic_index: values.extrinsic_index,
                        block: values.block,
                        timestamp: values.timestamp,
                        assets: []
                    }
                    movements[key].assets.push({
                        symbol: values.symbol,
                        amount: values.amount,
                        asset_unique_id: asset_unique_id,
                        decimals: values.decimals
                    })
                })
            })
        }
        const movementsList = Object.values(movements)
        logger.info(`Exit fetchAllBalanceChanges for ${chain.domain} and ${address} with ${movementsList.length} entries`)
        return Object.values(movementsList)
    }

    private update(assetMovements: TokenBalanceChange, event: EventDetails, uniqueId: string, symbol: string, decimals: number, amount: number) {
        const key = event.extrinsic_index ?? event.block_num ?? event.timestamp
        assetMovements[key] = assetMovements[key] ?? {}
        assetMovements[key][uniqueId] = assetMovements[key][uniqueId] ?? { 
            symbol: symbol,
            timestamp: event.timestamp,
            block: event.block_num,
            extrinsic_index: event.extrinsic_index,
            decimals, 
            amount: 0
        }
        assetMovements[key][uniqueId].amount += amount
    }

    async fetchBalanceMovements(chain: { domain: string, token: string }, address: string, events: SubscanEvent[]): Promise<TokenBalanceChange> {
        logger.info(`Entry BalancesChangesService.fetchBalanceMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`)
        const eventDetails: EventDetails[] = await this.subscanService.fetchEventDetails(chain.domain, events.filter(e => e.module_id === 'balances'))
        const assetMovements: TokenBalanceChange = {}
        const nativeToken = await this.subscanService.fetchNativeToken(chain.domain)
        const decimals = nativeToken.token_decimals
        for (const event of eventDetails) {
            let amount = 0
            switch (event.event_id) {
                case 'Withdraw':
                case 'Burned':
                amount -= getPropertyValue("amount", event)* Math.pow(10, -decimals)
                break;
                case 'Transfer':
                const to = extractAddress("to", event);
                if (to === address) {
                    amount += getPropertyValue("amount", event)* Math.pow(10, -decimals)
                } else {
                    amount -= getPropertyValue("amount", event)* Math.pow(10, -decimals)
                }
                break;
                case 'Deposit':
                case 'Minted':
                amount += getPropertyValue("amount", event)* Math.pow(10, -decimals)
                break;
            }
            this.update(assetMovements, event, chain.token, chain.token, decimals, amount)
        }
        logger.info(`Exit BalancesChangesService.fetchBalanceMovements for ${chain.domain} and ${address}} with ${assetMovements.lenght} entries`)
        return assetMovements
    }

    async fetchAssetMovements(chain: { domain: string, token: string }, address: string, events: SubscanEvent[]): Promise<TokenBalanceChange> {
        logger.info(`Entry BalancesChangesService.fetchAssetMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`)
        const assetEventDetails: EventDetails[] = await this.subscanService.fetchEventDetails(chain.domain, events.filter(e => e.module_id === 'assets'))
        const assetMovements: TokenBalanceChange = {}
        if (assetEventDetails.length === 0) {
            return assetMovements
        }
        const assets = await this.subscanService.scanAssets(chain.domain)
        for (const event of assetEventDetails) {
            const assetId = getPropertyValue("asset_id", event)
            const asset = assets.find(a => a.asset_id == assetId)
            let amount = 0
            switch (event.event_id) {
                case 'Withdrawn':
                amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
                break;
                case 'Burned':
                amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
                break;
                case 'Transferred':
                const to = extractAddress("to", event);
                if (to === address) {
                    amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
                } else {
                    amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
                }
                break;
                case 'Deposited':
                amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
                break;
                case 'Issued':
                amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
                break;
            }
            this.update(assetMovements, event, asset.unique_id, asset.symbol, asset.decimals, amount)
        }
        logger.info(`Exit BalancesChangesService.fetchAssetMovements for ${chain.domain} and ${address} with ${assetMovements.lenght} entries`)
        return assetMovements
    }

    async fetchForeignAssetMovements(chain: { domain: string, token: string }, address: string, events: SubscanEvent[]): Promise<TokenBalanceChange> {
        logger.info(`Entry BalancesChangesService.fetchForeignAssetMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`)
        const foreignAssetEventDetails: EventDetails[] = await this.subscanService.fetchEventDetails(chain.domain, events.filter(e => e.module_id === 'foreignassets'))
        const foreigAssetMovements: TokenBalanceChange = {}
        if (foreignAssetEventDetails.length === 0) {
            return foreigAssetMovements
        }
        const foreignAssets = await this.subscanService.fetchForeignAssets(chain.domain)

        for (const event of foreignAssetEventDetails) {
        const assetId: MultiLocation = getPropertyValue("asset_id", event)
        let foreignAsset = foreignAssets.find((a) =>
            isEqual(a.multi_location, assetId),
        );
        if (!foreignAsset && typeof assetId?.interior?.X1 === "object") {
            const assetIdAlt = {
                parents: assetId.parents,
                interior: { X1: [assetId?.interior?.X1] }
            } 
            foreignAsset = foreignAssets.find((a) =>
                isEqual(a.multi_location, assetIdAlt),
            );
        }
        let amount = 0
            switch (event.event_id) {
                case 'Withdrawn':
                amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
                break;
                case 'Burned':
                amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
                break;
                case 'Transferred':
                const to = extractAddress("to", event);
                if (to === address) {
                    amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
                } else {
                    amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
                }
                break;
                case 'Deposited':
                amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
                break;
                case 'Issued':
                amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
                break;
            }
            this.update(foreigAssetMovements, event, foreignAsset.unique_id, foreignAsset.symbol, foreignAsset.decimals, amount)
        }
        logger.info(`Exit BalancesChangesService.fetchForeignAssetMovements for ${chain.domain} and ${address} with ${foreigAssetMovements.lenght} entries`)
        return foreigAssetMovements
    }

    async fetchTokenMovements(chain: { domain: string, token: string }, address: string, events: SubscanEvent[]): Promise<TokenBalanceChange> {
        logger.info(`Entry BalancesChangesService.fetchTokenMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`)
        const tokenEventDetails: EventDetails[] = await this.subscanService.fetchEventDetails(chain.domain, events.filter(e => e.module_id === 'tokens'))
        const assetMovements: TokenBalanceChange = {}
        if (tokenEventDetails.length === 0) {
            return assetMovements
        }
        const tokens = await this.subscanService.scanTokens(chain.domain)
        for (const event of tokenEventDetails) {
            const token_id = getPropertyValue("currency_id", event)
            let token = tokens.find(t => t.token_id === token_id);
            let amount = 0
            if (!token) {
                console.log("undefined!")
                continue;
            }
            switch (event.event_id) {
                case 'Withdrawn':
                amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -token.decimals)
                break;
                case 'Transfer':
                const to = extractAddress("to", event);
                if (to === address) {
                    amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -token.decimals)
                } else {
                    amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -token.decimals)
                }
                break;
                case 'Deposited':
                amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -token.decimals)
                break;
                default:
                console.warn("Unkown eventId " + event.event_id)
            }
            this.update(assetMovements, event, token.unique_id, token.symbol, token.decimals, amount)
        }
        logger.info(`Exit BalancesChangesService.fetchTokenMovements for ${chain.domain} and ${address} with ${assetMovements.lenght} entries`)
        return assetMovements
    }
}