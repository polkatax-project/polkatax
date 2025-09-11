import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { Asset } from "../../blockchain/substrate/model/asset";
import { SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { logger } from "../../logger/logger";
import { PortfolioMovement } from "../model/portfolio-movement";
import { BalanceChange } from "./balance-change.service";

export class AssetMovementReconciliationService {
    constructor(private subscanService: SubscanService) {}
    
    async reconciliate(chain: { domain: string, token: string }, address: string, portfolioMovements: PortfolioMovement[], unmatchedEvents: SubscanEvent[], balancesChanges: BalanceChange[]) {
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
        const blocks = [...new Set([...balancesChanges.map(b => b.block), unmatchedEvents.map(e => e.event_index.split('-')[0]), portfolioMovements.filter(p => !!p.block).map(p => p.block)])]
        
        blocks.forEach(blockNum => {
            const balanceChanges = balancesChanges.filter(b => b.block === blockNum)
            const movements = portfolioMovements.filter(p => p.block === blockNum)
            let deviations = this.calculateDeviations(balanceChanges, movements, tokens)
            for (let j = 0; j < deviations.length; j++) {
                if (this.fixSymbolConfusion(deviations, deviations[j], movements)) {
                    deviations = this.calculateDeviations(balanceChanges, movements, tokens)
                    j = 0
                    continue
                } else {
                    this.compensateDeviation(address, portfolioMovements, deviations[j])
                }
            }
        })
    }

    private calculateDeviations(changes: BalanceChange[], movements: PortfolioMovement[], tokens: Asset[]): {
        symbol: string,
        asset_unique_id: string,
        decimals: number,
        deviation: number,
        extrinsic_index: string;
        timestamp: number;
        block: number;
    }[] {
        const uniqueIds = new Set<string>();
        changes.forEach(c => c.assets.forEach(a => uniqueIds.add(a.asset_unique_id)))
        movements.forEach(m => m.transfers.filter(t => !!t.asset_unique_id).forEach(t => uniqueIds.add(t.asset_unique_id)))
        const uniqueIdsArray = [...uniqueIds]

        return uniqueIdsArray.map(asset_unique_id => {
            const token = tokens.find(t => t.unique_id === asset_unique_id)
            const assetChange = changes.map(c => c.assets.filter(a => a.asset_unique_id === asset_unique_id).map(a => a.amount)).flat()
            const totalChange = assetChange.reduce((total, curr) => total + curr, 0)
            const portfolioTransfers = movements.map(m => m.transfers
                .filter(t => t.asset_unique_id === asset_unique_id).map(t => t.amount)).flat()
            const totalAmount = portfolioTransfers.reduce((total, current) => total + current, 0)
            return {
                symbol: token.symbol,
                asset_unique_id,
                decimals: token.decimals,
                extrinsic_index: changes?.[0].extrinsic_index ?? movements?.[0].extrinsic_index,
                timestamp: changes?.[0].timestamp ?? movements?.[0].timestamp,
                block: changes?.[0].block ?? movements?.[0].block,
                deviation: totalAmount - totalChange
            }
        })
    }

    fixSymbolConfusion(
        deviations: { symbol: string, asset_unique_id: string, decimals: number, deviation: number }[],
        tokenDeviation: {
            deviation: number;
            symbol: string;
            asset_unique_id: string;
            decimals: number;
        },
        movements: PortfolioMovement[],
        ): boolean {
        const otherToken = deviations.find(
            (d) =>
            (d.decimals + tokenDeviation.decimals <
                0.05 * tokenDeviation.deviation ||
                tokenDeviation.deviation === undefined) &&
            d.symbol.toUpperCase() === tokenDeviation.symbol.toUpperCase() &&
            d.asset_unique_id !== tokenDeviation.asset_unique_id,
        );

        const matchingXcms = movements.filter((p) =>
            p.transfers.some(
            (t) =>
                t.symbol.toUpperCase() === tokenDeviation.symbol.toUpperCase() &&
                t.module === "xcm" &&
                !(t as any).asset_unique_id_before_correction,
            ),
        );

        if (matchingXcms.length === 1) {
            const xcmTransfer = (matchingXcms[0].transfers ?? []).find(
            (t) =>
                t.symbol.toUpperCase() === tokenDeviation.symbol.toUpperCase() &&
                t.module === "xcm",
            );
            if (xcmTransfer && otherToken) {
            logger.info(
                `Fix: Adjusting assets in xcm transfer swapping ${tokenDeviation.symbol}. ${matchingXcms[0].extrinsic_index}, ${matchingXcms[0].timestamp}`,
            );
            (xcmTransfer as any).asset_unique_id_before_correction =
                xcmTransfer.asset_unique_id;
            xcmTransfer.asset_unique_id =
                xcmTransfer.asset_unique_id === tokenDeviation.asset_unique_id
                ? otherToken.asset_unique_id
                : tokenDeviation.asset_unique_id;
            return true;
            }

            const conflictingToken = deviations.find(
            (d) =>
                d.asset_unique_id === xcmTransfer.asset_unique_id &&
                d.symbol.toUpperCase() === tokenDeviation.symbol.toUpperCase() &&
                d.asset_unique_id !== tokenDeviation.asset_unique_id,
            );

            if (
            !conflictingToken &&
            xcmTransfer.amount * tokenDeviation.deviation > 0 &&
            xcmTransfer.asset_unique_id !== tokenDeviation.asset_unique_id
            ) {
            (xcmTransfer as any).asset_unique_id_before_correction =
                xcmTransfer.asset_unique_id;
            xcmTransfer.asset_unique_id = tokenDeviation.asset_unique_id;
            return true;
            }
        }
        return false;
    }

    compensateDeviation(
        address: string,
        portfolioMovements: PortfolioMovement[],
        tokenDeviation: {
          deviation: number;
          symbol: string;
          asset_unique_id: string;
          extrinsic_index: string;
          timestamp: number;
          block: number;
        }
      ) {
        const transferData = {
          symbol: tokenDeviation.symbol,
          asset_unique_id: tokenDeviation.asset_unique_id,
          to: tokenDeviation.deviation > 0 ? address : "",
          from: tokenDeviation.deviation < 0 ? address : "",
          amount: tokenDeviation.deviation,
          provenance: "deviationCompensation",
          events: []
        };
        const existingTx = portfolioMovements.find(
            (p) =>
            (tokenDeviation.extrinsic_index && tokenDeviation.extrinsic_index === p.extrinsic_index) ||
            (!tokenDeviation.extrinsic_index &&
            p.timestamp === tokenDeviation.timestamp),
        );
        if (existingTx) {
          logger.info(
            `Fix: Adding transfer of ${tokenDeviation.deviation} ${tokenDeviation.symbol} to existing tx ${existingTx.extrinsic_index}`,
          );
          existingTx.transfers.push(transferData);
        } else {
          logger.info(
            `Fix: Creating new tx with ${tokenDeviation.deviation} ${tokenDeviation.symbol}`,
          );
          portfolioMovements.push({
            events: [],
            extrinsic_index: tokenDeviation.extrinsic_index,
            block: tokenDeviation.block,
            timestamp: tokenDeviation.timestamp,
            provenance: "deviationCompensation",
            transfers: [transferData],
          });
        }
      }
}