import { SubscanApi } from "../blockchain/substrate/api/subscan.api";
import { Block } from "../blockchain/substrate/model/block";
import { PortfolioMovement } from "../data-aggregation/model/portfolio-movement";
import { SubscanEvent } from "../blockchain/substrate/model/subscan-event";
import {
  Deviation,
  PortfolioChangeValidationService,
} from "./portfolio-change-validation.service";
import { logger } from "../logger/logger";

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
    minBlock: Block,
    maxBlock: Block,
    tokenSymbol: string,
    tokenUniqueId?: string,
  ): Promise<number> {
    const { interval, deviations, tokenDeviation } =
      await this.splitIntervalAndFindDeviations(
        chain,
        address,
        portfolioMovements,
        minBlock,
        maxBlock,
        tokenSymbol,
        tokenUniqueId,
      );

    logger.info("zoomInAndFix Deviation: " + tokenDeviation.signedDeviation);

    if (
      this.fixSymbolConfusion(
        deviations,
        tokenDeviation,
        interval,
        portfolioMovements,
        tokenSymbol,
        tokenUniqueId,
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
        interval.startBlock,
        interval.endBlock,
        tokenSymbol,
        tokenUniqueId,
      );
    } else {
      this.compensateDeviation(
        address,
        portfolioMovements,
        unmatchedEvents,
        tokenDeviation.signedDeviation,
        deviations,
        interval.startBlock,
        interval.endBlock,
        tokenSymbol,
        tokenUniqueId,
      );
      return tokenDeviation.deviation;
    }
  }

  private async splitIntervalAndFindDeviations(
    chain: { domain: string; token: string },
    address: string,
    portfolioMovements: PortfolioMovement[],
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
        undefined,
        blocks[0].block_num,
        blocks[1].block_num,
      );
    const deviationsSecondHalf =
      await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
        chain,
        address,
        secondHalf,
        undefined,
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

  private fixSymbolConfusion(
    deviations: Deviation[],
    tokenDeviation: { deviation: number; signedDeviation: number },
    interval: { startBlock: Block; endBlock: Block },
    portfolioMovements: PortfolioMovement[],
    tokenSymbol: string,
    tokenUniqueId?: string,
  ): boolean {
    const problematicToken = deviations.find(
      (d) => d.unique_id === tokenUniqueId,
    )?.singlePaymentDeviationTooLarge;
    if (!problematicToken) return false;

    const otherToken = deviations.find(
      (d) =>
        d.signedDeviation + tokenDeviation.signedDeviation <
          0.05 * tokenDeviation.deviation &&
        d.symbol.toUpperCase() === tokenSymbol.toUpperCase() &&
        d.unique_id !== tokenUniqueId,
    );
    if (!otherToken) return false;

    const movements = portfolioMovements.filter(
      (p) =>
        p.timestamp > interval.startBlock.timestamp &&
        p.timestamp <= interval.endBlock.timestamp,
    );
    const matchingXcms = movements.filter((p) =>
      p.transfers.some(
        (t) =>
          t.symbol.toUpperCase() === tokenSymbol.toUpperCase() &&
          t.module === "xcm" &&
          !(t as any).asset_unique_id_before_correction,
      ),
    );

    if (matchingXcms.length === 1) {
      const xcmTransfer = (matchingXcms[0].transfers ?? []).find(
        (t) => t.symbol.toUpperCase() === tokenSymbol.toUpperCase(),
      );
      if (xcmTransfer) {
        logger.info(
          `Fix: Updating asset in xcm transfer ${matchingXcms[0].extrinsic_index}, ${matchingXcms[0].timestamp}`,
        );
        (xcmTransfer as any).asset_unique_id_before_correction =
          xcmTransfer.asset_unique_id;
        xcmTransfer.asset_unique_id =
          xcmTransfer.asset_unique_id === tokenUniqueId
            ? otherToken.unique_id
            : tokenUniqueId;
        return true;
      }
    }
    return false;
  }

  private compensateDeviation(
    address: string,
    taxableEvents: PortfolioMovement[],
    unmatchedEvents: SubscanEvent[],
    signedDeviation: number,
    deviations: Deviation[],
    startBlock: Block,
    endBlock: Block,
    tokenSymbol: string,
    tokenUniqueId?: string,
  ) {
    const amountSuitable = (transferAmount: number) => {
      if (signedDeviation > 0) {
        return transferAmount <= 0;
      } else {
        return transferAmount >= 0;
      }
    };
    const matchingEvents = unmatchedEvents.filter(
      (e) =>
        e.timestamp <= endBlock.timestamp && e.timestamp > startBlock.timestamp,
    );
    const matchingMovement = taxableEvents.find(
      (p) =>
        p.timestamp <= endBlock.timestamp &&
        p.timestamp > startBlock.timestamp &&
        p.transfers.some(
          (t) =>
            t.asset_unique_id === tokenUniqueId && amountSuitable(t.amount),
        ),
    );
    const matchingTransfer = (matchingMovement?.transfers ?? []).find(
      (t) => t.asset_unique_id === tokenUniqueId && amountSuitable(t.amount),
    );

    if (matchingTransfer) {
      logger.info(
        `Fix: Updating transfer amount in ${matchingMovement.extrinsic_index}`,
      );
      if (matchingTransfer.amount === -signedDeviation) {
        (matchingTransfer as any).amountBeforeCorrection =
          matchingTransfer.amount;
        matchingTransfer.amount = 0;
      } else {
        (matchingTransfer as any).amountBeforeCorrection =
          matchingTransfer.amount;
        matchingTransfer.amount += signedDeviation;
      }
      return;
    }

    const matchingXcm = taxableEvents.find(
      (p) =>
        p.timestamp <= endBlock.timestamp &&
        p.timestamp > startBlock.timestamp &&
        p.transfers.some(
          (t) =>
            t.module === "xcm" &&
            t.symbol.toUpperCase() === tokenSymbol.toUpperCase() &&
            amountSuitable(t.amount) &&
            !t.asset_unique_id,
        ),
    );
    const matchingXcmTransfer = (matchingXcm?.transfers ?? []).find(
      (t) =>
        t.symbol.toUpperCase() === tokenSymbol.toUpperCase() &&
        amountSuitable(t.amount) &&
        !t.asset_unique_id,
    );

    // remove or modify offending XCM
    if (matchingXcmTransfer) {
      const xcmMeantForThisToken = deviations.find(
        (d) =>
          d.symbol.toUpperCase() === tokenSymbol.toUpperCase() &&
          !d.absoluteDeviationTooLarge,
      );
      logger.info(
        `Fix: Updating transfer amount in xcm ${matchingXcmTransfer.extrinsic_index}`,
      );
      if (xcmMeantForThisToken) {
        matchingXcmTransfer.asset_unique_id = xcmMeantForThisToken.unique_id;
      } else {
        (matchingXcmTransfer as any).amountBeforeCorrection =
          matchingXcmTransfer.amount;
        matchingXcmTransfer.amount = 0;
      }
      return;
    }

    const existingTx = taxableEvents.find(
      (p) =>
        p.timestamp <= endBlock.timestamp && p.timestamp > startBlock.timestamp,
    );
    const transferData = {
      symbol: tokenSymbol,
      asset_unique_id: tokenUniqueId,
      to: signedDeviation > 0 ? address : "",
      from: signedDeviation < 0 ? address : "",
      amount: Math.abs(signedDeviation),
      provenance: "deviationCompensation",
      events: matchingEvents.map((e) => ({
        moduleId: e.module_id,
        eventId: e.event_id,
        eventIndex: e.event_index,
      })),
    };
    if (existingTx) {
      logger.info(
        `Fix: Adding transfer to existing tx ${existingTx.extrinsic_index}`,
      );
      existingTx.transfers.push(transferData);
    } else {
      logger.info(`Fix: Creating new tx`);
      taxableEvents.push({
        events: matchingEvents.map((e) => ({
          moduleId: e.module_id,
          eventId: e.event_id,
          eventIndex: e.event_index,
        })),
        extrinsic_index: "",
        block: endBlock.block_num,
        timestamp: endBlock.timestamp,
        provenance: "deviationCompensation",
        transfers: [transferData],
      });
    }
  }
}
