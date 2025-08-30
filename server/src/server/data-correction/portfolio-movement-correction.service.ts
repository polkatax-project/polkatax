import { SubscanApi } from "../blockchain/substrate/api/subscan.api";
import { Block } from "../blockchain/substrate/model/block";
import { SubscanEvent } from "../blockchain/substrate/model/subscan-event";
import {
  PortfolioMovement,
  TaxableEvent,
} from "../data-aggregation/model/portfolio-movement";
import { logger } from "../logger/logger";
import {
  Deviation,
  PortfolioChangeValidationService,
} from "./portfolio-change-validation.service";

export class PortfolioMovementCorrectionService {
  constructor(
    private subscanApi: SubscanApi,
    private portfolioChangeValidationService: PortfolioChangeValidationService,
  ) {}

  async zoomInAndFixLargestError(
    chain: { domain: string; token: string },
    address: string,
    portfolioMovements: PortfolioMovement[],
    unmatchedEvents: SubscanEvent[],
    minBlock: Block,
    maxBlock: Block,
    tokenSymbol: string,
    tokenUniqueId?: string,
  ): Promise<
    | {
        deviations: Deviation[];
        tokenDeviation: number;
        startBlock: Block;
        endBlock: Block;
        portfolioMovements: PortfolioMovement[];
      }
    | undefined
  > {
    const timestamps = [];
    const middleBlock = await this.subscanApi.fetchBlock(
      chain.domain,
      Math.floor((maxBlock.block_num - minBlock.block_num) / 2) +
        minBlock.block_num,
    );

    const blocks = [minBlock, middleBlock, maxBlock];

    for (const block of blocks) {
      timestamps.push(block.timestamp);
    }

    const portfolioMovementsFirstHalf = portfolioMovements.filter(
      (p) => p.timestamp >= timestamps[0] && p.timestamp <= timestamps[1],
    );
    const portfolioMovementsSecondHalf = portfolioMovements.filter(
      (p) => p.timestamp >= timestamps[1] && p.timestamp <= timestamps[2],
    );

    const deviationsFirstHalf =
      await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
        chain,
        address,
        portfolioMovementsFirstHalf,
        undefined,
        blocks[0].block_num,
        blocks[1].block_num,
      );
    const tokenDeviationFirstHalf = deviationsFirstHalf.find(
      (d) =>
        d.unique_id === tokenUniqueId ||
        (!tokenUniqueId && d.symbol === tokenSymbol),
    ) ?? {
      deviationPerPayment: 0,
      deviation: 0,
      signedDeviation: 0,
      balanceBefore: 0,
      balanceAfter: 0,
      expectedDiff: 0,
      diff: 0,
    };

    const deviationsSecondHalf =
      await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
        chain,
        address,
        portfolioMovementsSecondHalf,
        undefined,
        blocks[1].block_num,
        blocks[2].block_num,
      );

    const tokenDeviationSecondHalf = deviationsSecondHalf.find(
      (d) =>
        d.unique_id === tokenUniqueId ||
        (!tokenUniqueId && d.symbol === tokenSymbol),
    ) ?? {
      deviationPerPayment: 0,
      deviation: 0,
      signedDeviation: 0,
      balanceBefore: 0,
      balanceAfter: 0,
      expectedDiff: 0,
      diff: 0,
    };

    const intervalNo =
      tokenDeviationFirstHalf.deviation > tokenDeviationSecondHalf.deviation
        ? 0
        : 1;
    const nextInterval = {
      startBlock: blocks[intervalNo],
      endBlock: blocks[intervalNo + 1],
    };
    console.log(
      `Current deviations: ${JSON.stringify(tokenDeviationFirstHalf, null, 2)} ${JSON.stringify(tokenDeviationSecondHalf, null, 2)}`,
    );
    console.log(
      `Current deviation: ${Math.max(tokenDeviationSecondHalf.deviation, tokenDeviationFirstHalf.deviation)}. Next interval ${nextInterval.startBlock.block_num} - ${nextInterval.endBlock.block_num}`,
    );

    const deviations =
      intervalNo == 0 ? deviationsFirstHalf : deviationsSecondHalf;
    const tokenDeviation =
      intervalNo == 0 ? tokenDeviationFirstHalf : tokenDeviationSecondHalf;

    if (
      deviations.find((d) => d.unique_id === tokenUniqueId)
        .absoluteDeviationTooLarge
    ) {
      const otherTokenWithSameSymbolSimilarDeviation = deviations.find(
        (d) =>
          d.signedDeviation + tokenDeviation.signedDeviation <
            0.05 * tokenDeviation.deviation &&
          d.symbol.toUpperCase() === tokenSymbol.toUpperCase() &&
          d.unique_id !== tokenUniqueId,
      );
      if (otherTokenWithSameSymbolSimilarDeviation) {
        const movements =
          intervalNo == 0
            ? portfolioMovementsFirstHalf
            : portfolioMovementsSecondHalf;
        const matchingXcm = movements.find(
          (p) =>
            p.label === "XCM transfer" &&
            p.transfers.some(
              (t) => t.symbol.toUpperCase() === tokenSymbol.toUpperCase(),
            ),
        );
        const matchingXcmTransfer = (matchingXcm?.transfers ?? []).find(
          (t) => t.symbol.toUpperCase() === tokenSymbol.toUpperCase(),
        );
        if (matchingXcmTransfer) {
          // swap unique_asset_id
          (matchingXcmTransfer as any).asset_unique_id_before_correction =
            matchingXcmTransfer.asset_unique_id;
          matchingXcmTransfer.asset_unique_id =
            matchingXcmTransfer.asset_unique_id === tokenUniqueId
              ? otherTokenWithSameSymbolSimilarDeviation.unique_id
              : tokenUniqueId;
          return;
        }
      }
    }

    if (
      nextInterval.endBlock.block_num - nextInterval.startBlock.block_num >
      1
    ) {
      return await this.zoomInAndFixLargestError(
        chain,
        address,
        portfolioMovements,
        unmatchedEvents,
        nextInterval.startBlock,
        nextInterval.endBlock,
        tokenSymbol,
        tokenUniqueId,
      );
    } else {
      const deviations =
        tokenDeviationFirstHalf.deviation > tokenDeviationSecondHalf.deviation
          ? deviationsFirstHalf
          : deviationsSecondHalf;
      const tokenDeviation =
        tokenDeviationFirstHalf.deviation > tokenDeviationSecondHalf.deviation
          ? tokenDeviationFirstHalf.diff - tokenDeviationFirstHalf.expectedDiff
          : tokenDeviationSecondHalf.diff -
            tokenDeviationSecondHalf.expectedDiff;
      this.compensateDeviation(
        address,
        portfolioMovements as PortfolioMovement[],
        unmatchedEvents,
        tokenDeviation,
        deviations,
        nextInterval.startBlock,
        nextInterval.endBlock,
        tokenSymbol,
        tokenUniqueId,
      );
    }
  }

  compensateDeviation(
    address: string,
    taxableEvents: PortfolioMovement[],
    unmatchedEvents: SubscanEvent[],
    deviation: number,
    deviations: Deviation[],
    startBlock: Block,
    endBlock: Block,
    tokenSymbol: string,
    tokenUniqueId?: string,
  ) {
    const amountSuitable = (transferAmount: number) => {
      if (deviation > 0) {
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
      if (matchingTransfer.amount === -deviation) {
        // TODO:! matchingMovement.transfers = matchingMovement.transfers.filter(t => t !== matchingTransfer)
        (matchingTransfer as any).amountBeforeCorrection =
          matchingTransfer.amount;
        matchingTransfer.amount = 0;
      } else {
        (matchingTransfer as any).amountBeforeCorrection =
          matchingTransfer.amount;
        matchingTransfer.amount += deviation;
      }
      return;
    }

    const matchingXcm = taxableEvents.find(
      (p) =>
        p.timestamp <= endBlock.timestamp &&
        p.timestamp > startBlock.timestamp &&
        p.label === "XCM transfer" &&
        p.transfers.some(
          (t) =>
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
      if (xcmMeantForThisToken) {
        matchingXcmTransfer.asset_unique_id = xcmMeantForThisToken.unique_id;
      } else {
        (matchingXcmTransfer as any).amountBeforeCorrection =
          matchingXcmTransfer.amount;
        matchingXcmTransfer.amount = 0;
        // TODO matchingXcm.transfers = matchingXcm.transfers.filter(t => t !== matchingXcmTransfer)
      }
      return;
    }

    const exsitingTx = taxableEvents.find(
      (p) =>
        p.timestamp <= endBlock.timestamp && p.timestamp > startBlock.timestamp,
    );
    const transferData = {
      symbol: tokenSymbol,
      asset_unique_id: tokenUniqueId,
      to: deviation > 0 ? address : "",
      from: deviation < 0 ? address : "",
      amount: deviation,
      provenance: "deviationCompensation",
      events: matchingEvents.map((e) => ({
        moduleId: e.module_id,
        eventId: e.event_id,
        eventIndex: e.event_index,
      })),
    };
    if (exsitingTx) {
      exsitingTx.transfers.push(transferData);
    } else {
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

  async fixErrorsAndMissingData(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: TaxableEvent[],
    unmatchedEvents: SubscanEvent[],
    acceptedDeviations?: {
      symbol: string;
      perPayment: number;
      max: number;
    }[],
    minBlockNum?: number,
    maxBlockNum?: number,
  ) {
    minBlockNum =
      minBlockNum ??
      portfolioMovements.reduce(
        (curr, next) =>
          Math.min(
            curr,
            (next as PortfolioMovement)?.block ?? Number.MAX_SAFE_INTEGER,
          ),
        Number.MAX_SAFE_INTEGER,
      );
    maxBlockNum =
      maxBlockNum ??
      portfolioMovements.reduce(
        (curr, next) => Math.max(curr, (next as PortfolioMovement)?.block ?? 0),
        0,
      );

    const initialDeviations =
      await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
        chainInfo,
        address,
        portfolioMovements,
        acceptedDeviations,
        minBlockNum,
        maxBlockNum,
      );

    const minBlock = await this.subscanApi.fetchBlock(
      chainInfo.domain,
      minBlockNum,
    );
    const maxBlock = await this.subscanApi.fetchBlock(
      chainInfo.domain,
      maxBlockNum,
    );

    // TODO
    let selectedToken =
      initialDeviations.find((d) => d.absoluteDeviationTooLarge) ??
      initialDeviations.find((d) => d.perPaymentDeviationTooLarge);

    const maxTurns = 100;
    let counter = 0;
    while (selectedToken && counter <= maxTurns) {
      logger.info("Fixing errors counter: " + counter);
      await this.zoomInAndFixLargestError(
        chainInfo,
        address,
        portfolioMovements as PortfolioMovement[],
        unmatchedEvents,
        minBlock,
        maxBlock,
        selectedToken.symbol,
        selectedToken.unique_id,
      );

      const updatedDeviations =
        await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
          chainInfo,
          address,
          portfolioMovements,
          acceptedDeviations,
          minBlockNum,
          maxBlockNum,
        ); // TODO
      selectedToken =
        updatedDeviations.find((d) => d.absoluteDeviationTooLarge) ??
        updatedDeviations.find((d) => d.perPaymentDeviationTooLarge);
      counter++;
    }
    logger.info("All errors fixed");
  }
}
