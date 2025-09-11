import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { PortfolioMovement } from "../model/portfolio-movement";
import { Transaction } from "../../blockchain/substrate/model/transaction";
import { EventDerivedTransfer } from "../model/event-derived-transfer"
import { XcmAssetMovement, XcmTransfer } from "../../blockchain/substrate/model/xcm-transfer";
import { Asset } from "../../blockchain/substrate/model/asset";
import { SubscanEvent } from "../../blockchain/substrate/model/subscan-event";

const getDecimals = (assetUniqueId: string, tokens: Asset[]) => {
    return tokens.find(t => t.unique_id === assetUniqueId)?.decimals   
}

const isCloseTo = (a: number, b: number) => {
    if (a === b) {
        return true
    }
    return (Math.abs(a - b) / (Math.abs(a) + Math.abs(b)) < 0.01)
}


export class ReconciliationService {
    constructor(private subscanService: SubscanService) {}
    
    async reconcile(chain: { domain: string, token: string }, 
        portfolioMovements: PortfolioMovement[], 
        transactions: Transaction[], 
        transfers: EventDerivedTransfer[], 
        xcmTransfers: XcmTransfer[],
        events: SubscanEvent[]) {
        const tokens = await this.subscanService.scanTokensAndAssets(chain.domain)
        if (!tokens.find(t => t.native)) {
            tokens.push({
                id: chain.token,
                asset_id: chain.token,
                symbol: chain.token,
                unique_id: chain.token,
                decimals: (await this.subscanService.fetchNativeToken(chain.domain)).token_decimals
            })
        }
        
        const indexedTx: Record<string, Transaction> = {}
        transactions.forEach((tx) => {
            indexedTx[tx.extrinsic_index] = tx
        })

        const indexedTransfers: Record<string, EventDerivedTransfer[]> = {}
        transfers.forEach((transfer) => {
            indexedTransfers[transfer.extrinsic_index] = indexedTransfers[transfer.extrinsic_index] ?? []
            indexedTransfers[transfer.extrinsic_index].push(transfer)
        })

        for (let portfolioMovement of portfolioMovements) {
            /**
             * Using transaction information
             */
            const matchingTx = indexedTx[portfolioMovement.extrinsic_index]
            portfolioMovement.feeUsed = matchingTx?.feeUsed
            portfolioMovement.callModule = matchingTx?.callModule
            portfolioMovement.callModuleFunction = matchingTx?.callModuleFunction
            const transferMatchingFee = matchingTx ? portfolioMovement.transfers.find(t => isCloseTo(- t.amount * Math.pow(10, getDecimals(t.asset_unique_id, tokens)), portfolioMovement?.feeUsed)) : undefined
            if (transferMatchingFee) {
                portfolioMovement.feeTokenSymbol = transferMatchingFee.symbol
                portfolioMovement.feeTokenUniqueId = transferMatchingFee.asset_unique_id
                portfolioMovement.transfers = portfolioMovement.transfers.filter(t => t !== transferMatchingFee)
            }

            /**
             * Use transfers and outgoing XCM transfers
             */
            const semanticTransfers = indexedTransfers[portfolioMovement.extrinsic_index] ?? []
            for (let transfer of portfolioMovement.transfers) {
                let matchingSemanticTransfer: EventDerivedTransfer | XcmAssetMovement = semanticTransfers
                    .find(t => !t['tainted'] && t.amount === transfer.amount && t.symbol.toUpperCase() === transfer.symbol.toUpperCase())
                if (!matchingSemanticTransfer) {
                    const matchingXcm = xcmTransfers.find(t => t.timestamp === portfolioMovement.timestamp && t.transfers.some(t => !t['tainted'] && t.amount === transfer.amount))
                    matchingSemanticTransfer = (matchingXcm?.transfers ?? []).find(t => t.outgoing && t.amount === transfer.amount && (t.symbol.toUpperCase() === transfer.symbol.toUpperCase() || t.asset_unique_id === transfer.asset_unique_id))
                }
                if (matchingSemanticTransfer) {
                    transfer.module = matchingSemanticTransfer.module
                    transfer.price = matchingSemanticTransfer.price
                    transfer.fiatValue = matchingSemanticTransfer.fiatValue
                    transfer.to = transfer.to ?? matchingSemanticTransfer.to
                    transfer.from = transfer.from ?? matchingSemanticTransfer.from
                    transfer.fromChain = matchingSemanticTransfer.fromChain
                    transfer.toChain = matchingSemanticTransfer.destChain
                    transfer.semanticEventId = (matchingSemanticTransfer as EventDerivedTransfer).original_event_id
                    transfer.label = (matchingSemanticTransfer as EventDerivedTransfer)?.label ?? matchingSemanticTransfer.module === 'xcm' ? 'XCM transfer' : undefined
                    transfer['reconciled'] = true
                    matchingSemanticTransfer['tainted'] = true
                }
            }

            /**
             * XCM Transfers incoming
             */
            const remainingTransfers = portfolioMovement.transfers.filter(t => !t['reconciled'])
            const timespan = [portfolioMovement.timestamp - 20_000, portfolioMovement.timestamp] // up until 20 seconds ago.
            const relevantXcmTransfers = xcmTransfers.filter(xcm => xcm.timestamp >= timespan[0] && xcm.timestamp <= timespan[1] && xcm.transfers.some(t => !t.outgoing))
            for (let transfer of remainingTransfers) {
                const matchingXcm = relevantXcmTransfers.find(xcm => 
                    xcm.transfers.some(t => !t['tainted'] && t.amount === transfer.amount && (t.symbol.toUpperCase() === transfer.symbol.toUpperCase()))
                )
                const matchingTransfer = (matchingXcm?.transfers ?? []).find(t => !t['tainted'] && t.amount === transfer.amount && (t.symbol.toUpperCase() === transfer.symbol.toUpperCase()))
                if (matchingTransfer) {
                    matchingTransfer['tainted'] = true
                    transfer['reconciled'] = true
                    transfer.module = 'xcm'
                    transfer.price = matchingTransfer.price
                    transfer.fiatValue = matchingTransfer.fiatValue
                    transfer.to = transfer.to ?? matchingTransfer.to
                    transfer.from = transfer.from ?? matchingTransfer.from
                    transfer.fromChain = matchingTransfer.fromChain
                    transfer.toChain = matchingTransfer.destChain
                    transfer.label = 'XCM transfer' 
                }
            }
        }

    }
}