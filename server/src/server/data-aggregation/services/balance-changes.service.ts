import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { MultiLocation } from "../../blockchain/substrate/model/multi-location";
import { EventDetails, SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { logger } from "../../logger/logger";
import { PortfolioMovement } from "../model/portfolio-movement";
import { extractAddress, getPropertyValue } from "./special-event-processing/helper";
import isEqual from "lodash.isequal";

export class BalanceChangesService {

    constructor(private subscanService: SubscanService) {}

    async fetchAllBalanceChanges(chain: { domain: string, token: string }, address: string, subscanEvents: SubscanEvent[]): Promise<PortfolioMovement[]> {
        logger.info(`Entry fetchAllBalanceChanges for ${chain.domain} and ${address}. SubscanEvents: ${subscanEvents.length}`)
        let portfolioMovements: PortfolioMovement[] = []
        await this.fetchBalanceMovements(chain, address, subscanEvents, portfolioMovements)
        await this.fetchAssetMovements(chain, address, subscanEvents, portfolioMovements)
        await this.fetchForeignAssetMovements(chain, address, subscanEvents, portfolioMovements)
        await this.fetchTokenMovements(chain, address, subscanEvents, portfolioMovements)

        portfolioMovements = portfolioMovements.sort(
        (a, b) => a.timestamp - b.timestamp,
        );
        logger.info(`Exit fetchAllBalanceChanges for ${chain.domain} and ${address} with ${portfolioMovements.length} entries`)
        return portfolioMovements
    }

    private update(portfolioMovements: PortfolioMovement[], event: EventDetails, symbol: string, asset_unique_id: string, from: string, to: string, amount: number) {
        let movement = portfolioMovements.find(p => p.extrinsic_index === event.extrinsic_index) 
        if (!movement) {
            movement = {hash: event.extrinsic_hash,
            block: event.block_num,
            timestamp: event.timestamp,
            extrinsic_index: event.extrinsic_index,
            events: [],
            transfers: []
            }
            portfolioMovements.push(movement)
        }
        movement.transfers.push({
            symbol,
            amount,
            from,
            to,
            extrinsic_index: event.extrinsic_index,
            asset_unique_id,
            event_index: event.original_event_index
        })
    }

    async fetchBalanceMovements(chain: { domain: string, token: string }, address: string, events: SubscanEvent[], portfolioMovements: PortfolioMovement[]): Promise<void> {
        logger.info(`Entry BalancesChangesService.fetchBalanceMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`)
        const eventDetails: EventDetails[] = await this.subscanService.fetchEventDetails(chain.domain, events.filter(e => e.module_id === 'balances'))
        const nativeToken = await this.subscanService.fetchNativeToken(chain.domain)
        const decimals = nativeToken.token_decimals
        for (const event of eventDetails) {
            let amount = 0
            let to = ''
            let from = ''
            switch (event.event_id) {
                case 'Withdraw':
                case 'Burned':
                amount -= getPropertyValue("amount", event)* Math.pow(10, -decimals);
                from = address
                break;
                case 'Transfer':
                to = extractAddress("to", event);
                from = extractAddress("from", event);
                if (to === address) {
                    amount += getPropertyValue("amount", event)* Math.pow(10, -decimals)
                } else {
                    amount -= getPropertyValue("amount", event)* Math.pow(10, -decimals)
                }
                break;
                case 'Deposit':
                case 'Minted':
                to = address
                amount += getPropertyValue("amount", event)* Math.pow(10, -decimals)
                break;
                default:
                    continue
            }
            this.update(portfolioMovements, event, chain.token, chain.token, to, from, amount)
        }
        logger.info(`Exit BalancesChangesService.fetchBalanceMovements for ${chain.domain} and ${address}} with ${eventDetails.length} entries`)
    }

    async fetchAssetMovements(chain: { domain: string, token: string }, address: string, events: SubscanEvent[], portfolioMovements: PortfolioMovement[]): Promise<void> {
        logger.info(`Entry BalancesChangesService.fetchAssetMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`)
        const assetEventDetails: EventDetails[] = await this.subscanService.fetchEventDetails(chain.domain, events.filter(e => e.module_id === 'assets'))
        if (assetEventDetails.length === 0) {
            return 
        }
        const assets = await this.subscanService.scanAssets(chain.domain)
        for (const event of assetEventDetails) {
            if (event.original_event_index === "7465599-3") {
                console.log("TODO!_")
            }
            const assetId = getPropertyValue("asset_id", event)
            const asset = assets.find(a => a.asset_id == assetId)
            let amount = 0
            let to = ''
            let from = ''
            switch (event.event_id) {
                case 'Withdrawn':
                amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
                from = address
                break;
                case 'Burned':
                amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
                from = address
                break;
                case 'Transferred':
                to = extractAddress("to", event);
                from = extractAddress("from", event);
                if (to === address) {
                    amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
                } else {
                    amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
                }
                break;
                case 'Deposited':
                amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals);
                to = address
                break;
                case 'Issued':
                amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals);
                to = address
                break;
                default:
                continue
            }
            this.update(portfolioMovements, event, asset.symbol, asset.unique_id, to, from, amount)
        }
        logger.info(`Exit BalancesChangesService.fetchAssetMovements for ${chain.domain} and ${address} with ${assetEventDetails.length} entries`)
    }

    async fetchForeignAssetMovements(chain: { domain: string, token: string }, address: string, events: SubscanEvent[], portfolioMovements: PortfolioMovement[]): Promise<void> {
        logger.info(`Entry BalancesChangesService.fetchForeignAssetMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`)
        const foreignAssetEventDetails: EventDetails[] = await this.subscanService.fetchEventDetails(chain.domain, events.filter(e => e.module_id === 'foreignassets'))
        if (foreignAssetEventDetails.length === 0) {
            return 
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
        let to = ''
        let from = ''
        switch (event.event_id) {
            case 'Withdrawn':
            amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
            from = address
            break;
            case 'Burned':
            amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
            from = address
            break;
            case 'Transferred':
            to = extractAddress("to", event);
            from = extractAddress("from", event);
            if (to === address) {
                amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
            } else {
                amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
            }
            break;
            case 'Deposited':
            to = address
            amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
            break;
            case 'Issued':
            to = address
            amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
            break;
            default:
              continue
        }
        this.update(portfolioMovements, event, foreignAsset.symbol, foreignAsset.unique_id, to, from, amount)
        }
        logger.info(`Exit BalancesChangesService.fetchForeignAssetMovements for ${chain.domain} and ${address} with ${foreignAssetEventDetails.length} entries`)
    }

    async fetchTokenMovements(chain: { domain: string, token: string }, address: string, events: SubscanEvent[], portfolioMovements: PortfolioMovement[]): Promise<void> {
        logger.info(`Entry BalancesChangesService.fetchTokenMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`)
        const tokenEventDetails: EventDetails[] = await this.subscanService.fetchEventDetails(chain.domain, events.filter(e => e.module_id === 'tokens'))
        if (tokenEventDetails.length === 0) {
            return 
        }
        const tokens = await this.subscanService.scanTokens(chain.domain)
        for (const event of tokenEventDetails) {
            const token_id = getPropertyValue("currency_id", event)
            let token = tokens.find(t => t.token_id === token_id);
            let amount = 0
            let to = ''
            let from = ''
            if (!token) {
                console.log("undefined!")
                continue;
            }
            switch (event.event_id) {
                case 'Withdrawn':
                    from = address
                    amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -token.decimals)
                    break;
                case 'Transfer':
                    to = extractAddress("to", event);
                    from = extractAddress("from", event);
                    if (to === address) {
                        amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -token.decimals)
                    } else {
                        amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -token.decimals)
                    }
                break;
                case 'Deposited':
                    to = address
                    amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -token.decimals)
                break;
                default:
                    continue
            }
            this.update(portfolioMovements, event, token.symbol, token.unique_id, to, from, amount)
        }
        logger.info(`Exit BalancesChangesService.fetchTokenMovements for ${chain.domain} and ${address} with ${tokenEventDetails.length} entries`)
    }
}