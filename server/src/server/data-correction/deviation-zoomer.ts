import { SubscanApi } from "../blockchain/substrate/api/subscan.api";
import { Block } from "../blockchain/substrate/model/block";
import { PortfolioMovement } from "../data-aggregation/model/portfolio-movement";
import { SubscanEvent } from "../blockchain/substrate/model/subscan-event";
import { PortfolioChangeValidationService } from "./portfolio-change-validation.service";
import { logger } from "../logger/logger";
import { DeviationLimit } from "./model/deviation-limit";
import { Deviation } from "./model/deviation";

const emptyDeviation = {
  deviation: 0,
  signedDeviation: 0,
  balanceBefore: 0,
  balanceAfter: 0,
  expectedDiff: 0,
  diff: 0,
  singlePaymentDeviationTooLarge: false,
  absoluteDeviationTooLarge: false,
};

export class DeviationZoomer {
  constructor(
    private subscanApi: SubscanApi,
    private portfolioChangeValidationService: PortfolioChangeValidationService,
  ) {}

  async zoomInAndFix(
    chain: { domain: string; token: string },
    address: string,
    portfolioMovements: PortfolioMovement[],
    unmatchedEvents: SubscanEvent[],
    acceptedDeviations: DeviationLimit[],
    minBlock: Block,
    maxBlock: Block,
    tokenSymbol: string,
    tokenUniqueId?: string,
  ): Promise<number> {
    logger.debug(
      `Enter splitIntervalAndFindDeviations on ${chain.domain} and ${address}`,
    );
    const { interval, deviations, tokenDeviation } =
      await this.splitIntervalAndFindDeviations(
        chain,
        address,
        portfolioMovements,
        acceptedDeviations,
        minBlock,
        maxBlock,
        tokenSymbol,
        tokenUniqueId,
      );

    logger.debug(
      `zoomInAndFix on ${chain.domain} and ${address}. Deviation  ${tokenDeviation.signedDeviation} ${tokenSymbol}`,
    );

    if (
      this.fixSymbolConfusion(
        deviations,
        { ...tokenDeviation, symbol: tokenSymbol, unique_id: tokenUniqueId },
        interval,
        portfolioMovements,
      )
    ) {
      return tokenDeviation.deviation;
    }

    if (interval.endBlock.block_num - interval.startBlock.block_num > 1) {
      return this.zoomInAndFix(
        chain,
        address,
        portfolioMovements,
        unmatchedEvents,
        acceptedDeviations,
        interval.startBlock,
        interval.endBlock,
        tokenSymbol,
        tokenUniqueId,
      );
    } else {
      logger.info(
        `Enter compensateDeviation on ${chain.domain} and ${address}`,
      );

      this.compensateDeviation(
        address,
        portfolioMovements,
        unmatchedEvents,
        { ...tokenDeviation, symbol: tokenSymbol, unique_id: tokenUniqueId },
        interval.startBlock,
        interval.endBlock,
      );
      logger.info(`Exit compensateDeviation on ${chain.domain} and ${address}`);
      return tokenDeviation.deviation;
    }
  }

  private async splitIntervalAndFindDeviations(
    chain: { domain: string; token: string },
    address: string,
    portfolioMovements: PortfolioMovement[],
    acceptedDeviations: DeviationLimit[],
    minBlock: Block,
    maxBlock: Block,
    tokenSymbol: string,
    tokenUniqueId?: string,
  ): Promise<{
    interval: { startBlock: Block; endBlock: Block };
    deviations: Deviation[];
    tokenDeviation: { deviation: number; signedDeviation: number };
  }> {
    const middleBlock = await this.subscanApi.fetchBlock(
      chain.domain,
      Math.floor((maxBlock.block_num - minBlock.block_num) / 2) +
        minBlock.block_num,
    );

    const blocks = [minBlock, middleBlock, maxBlock];
    const timestamps = blocks.map((b) => b.timestamp);

    const firstHalf = portfolioMovements.filter(
      (p) => p.timestamp >= timestamps[0] && p.timestamp <= timestamps[1],
    );
    const secondHalf = portfolioMovements.filter(
      (p) => p.timestamp >= timestamps[1] && p.timestamp <= timestamps[2],
    );

    const deviationsFirstHalf =
      await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
        chain,
        address,
        firstHalf,
        acceptedDeviations,
        blocks[0].block_num,
        blocks[1].block_num,
      );
    const deviationsSecondHalf =
      await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
        chain,
        address,
        secondHalf,
        acceptedDeviations,
        blocks[1].block_num,
        blocks[2].block_num,
      );

    const tokenDeviationFirst = deviationsFirstHalf.find(
      (d) =>
        d.unique_id === tokenUniqueId ||
        (!tokenUniqueId && d.symbol === tokenSymbol),
    ) ?? { ...emptyDeviation, symbol: tokenSymbol, unique_id: tokenUniqueId };
    const tokenDeviationSecond = deviationsSecondHalf.find(
      (d) =>
        d.unique_id === tokenUniqueId ||
        (!tokenUniqueId && d.symbol === tokenSymbol),
    ) ?? { ...emptyDeviation, symbol: tokenSymbol, unique_id: tokenUniqueId };

    const intervalNo =
      tokenDeviationFirst.deviation > tokenDeviationSecond.deviation ? 0 : 1;
    return {
      interval: {
        startBlock: blocks[intervalNo],
        endBlock: blocks[intervalNo + 1],
      },
      deviations: intervalNo === 0 ? deviationsFirstHalf : deviationsSecondHalf,
      tokenDeviation:
        intervalNo === 0 ? tokenDeviationFirst : tokenDeviationSecond,
    };
  }

  fixSymbolConfusion(
    deviations: Deviation[],
    tokenDeviation: {
      deviation: number;
      signedDeviation: number;
      symbol: string;
      unique_id: string;
    },
    interval: { startBlock: Block; endBlock: Block },
    portfolioMovements: PortfolioMovement[],
  ): boolean {
    const problematicToken = deviations.find(
      (d) => d.unique_id === tokenDeviation.unique_id,
    )?.singlePaymentDeviationTooLarge;
    if (!problematicToken) return false;

    const otherToken = deviations.find(
      (d) =>
        (d.signedDeviation + tokenDeviation.signedDeviation <
          0.05 * tokenDeviation.deviation ||
          tokenDeviation.deviation === undefined) &&
        d.symbol.toUpperCase() === tokenDeviation.symbol.toUpperCase() &&
        d.unique_id !== tokenDeviation.unique_id,
    );

    const movements = portfolioMovements.filter(
      (p) =>
        p.timestamp > interval.startBlock.timestamp &&
        p.timestamp <= interval.endBlock.timestamp,
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
          xcmTransfer.asset_unique_id === tokenDeviation.unique_id
            ? otherToken.unique_id
            : tokenDeviation.unique_id;
        return true;
      }

      const conflictingToken = deviations.find(
        (d) =>
          d.unique_id === xcmTransfer.asset_unique_id &&
          d.symbol.toUpperCase() === tokenDeviation.symbol.toUpperCase() &&
          d.unique_id !== tokenDeviation.unique_id,
      );

      if (
        !conflictingToken &&
        xcmTransfer.amount * tokenDeviation.signedDeviation > 0 &&
        xcmTransfer.asset_unique_id !== tokenDeviation.unique_id
      ) {
        (xcmTransfer as any).asset_unique_id_before_correction =
          xcmTransfer.asset_unique_id;
        xcmTransfer.asset_unique_id = tokenDeviation.unique_id;
        return true;
      }
    }
    return false;
  }

  compensateDeviation(
    address: string,
    taxableEvents: PortfolioMovement[],
    unmatchedEvents: SubscanEvent[],
    tokenDeviation: {
      deviation: number;
      signedDeviation: number;
      symbol: string;
      unique_id: string;
    },
    startBlock: Block,
    endBlock: Block,
  ) {
    const matchingEvents = unmatchedEvents.filter(
      (e) =>
        e.timestamp <= endBlock.timestamp && e.timestamp > startBlock.timestamp,
    );

    const extrinsicIndices = [
      ...new Set(
        matchingEvents
          .filter((e) => !!e.extrinsic_index)
          .map((e) => e.extrinsic_index),
      ),
    ];
    const extrinsicIndex =
      extrinsicIndices.length === 1 ? extrinsicIndices[0] : undefined;
    const existingTx = taxableEvents.find(
      (p) =>
        (extrinsicIndex && extrinsicIndex === p.extrinsic_index) ||
        (!extrinsicIndex &&
          p.timestamp <= endBlock.timestamp &&
          p.timestamp > startBlock.timestamp),
    );
    const transferData = {
      symbol: tokenDeviation.symbol,
      asset_unique_id: tokenDeviation.unique_id,
      to: tokenDeviation.signedDeviation > 0 ? address : undefined,
      from: tokenDeviation.signedDeviation < 0 ? address : undefined,
      amount: tokenDeviation.signedDeviation,
      provenance: "deviationCompensation",
      events: matchingEvents.map((e) => ({
        moduleId: e.module_id,
        eventId: e.event_id,
        eventIndex: e.event_index,
      })),
    };
    if (existingTx) {
      logger.info(
        `Fix: Adding transfer of ${tokenDeviation.signedDeviation} ${tokenDeviation.symbol} to existing tx ${existingTx.extrinsic_index}`,
      );
      existingTx.transfers.push(transferData);
    } else {
      logger.info(
        `Fix: Creating new tx with ${tokenDeviation.signedDeviation} ${tokenDeviation.symbol}`,
      );
      taxableEvents.push({
        events: matchingEvents.map((e) => ({
          moduleId: e.module_id,
          eventId: e.event_id,
          eventIndex: e.event_index,
        })),
        extrinsic_index: extrinsicIndex,
        block: endBlock.block_num,
        timestamp: endBlock.timestamp,
        provenance: "deviationCompensation",
        transfers: [transferData],
      });
    }
  }
}
