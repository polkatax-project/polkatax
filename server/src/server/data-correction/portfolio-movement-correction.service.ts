import { SubscanApi } from "../blockchain/substrate/api/subscan.api";
import { Block } from "../blockchain/substrate/model/block";
import { SubscanEvent } from "../blockchain/substrate/model/subscan-event";
import * as substraeteToCoingeckoIds from "../../../res/substrate-token-to-coingecko-id.json";
import {
  PortfolioMovement,
  TaxableEvent,
} from "../data-aggregation/model/portfolio-movement";
import { logger } from "../logger/logger";
import {
  Deviation,
  PortfolioChangeValidationService,
} from "./portfolio-change-validation.service";
import { FetchCurrentPrices } from "./fetch-crypto-prices";
import { BlockTimeService } from "../blockchain/substrate/services/block-time.service";
import { isEvmAddress } from "../data-aggregation/helper/is-evm-address";
import { SubscanService } from "../blockchain/substrate/api/subscan.service";
import { chown } from "fs";

const emptyDeviation = {
  deviation: 0,
  signedDeviation: 0,
  balanceBefore: 0,
  balanceAfter: 0,
  expectedDiff: 0,
  diff: 0,
  singlePaymentDeviationTooLarge: false,
};

export class PortfolioMovementCorrectionService {
  constructor(
    private subscanApi: SubscanApi,
    private portfolioChangeValidationService: PortfolioChangeValidationService,
    private fetchCurrentPrices: FetchCurrentPrices,
    private blockTimeService: BlockTimeService,
    private subscanService: SubscanService,
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
  ): Promise<boolean> {
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
    const tokenDeviationFirstHalf =
      deviationsFirstHalf.find(
        (d) =>
          d.unique_id === tokenUniqueId ||
          (!tokenUniqueId && d.symbol === tokenSymbol),
      ) ?? emptyDeviation;

    const deviationsSecondHalf =
      await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
        chain,
        address,
        portfolioMovementsSecondHalf,
        undefined,
        blocks[1].block_num,
        blocks[2].block_num,
      );

    const tokenDeviationSecondHalf =
      deviationsSecondHalf.find(
        (d) =>
          d.unique_id === tokenUniqueId ||
          (!tokenUniqueId && d.symbol === tokenSymbol),
      ) ?? emptyDeviation;

    const intervalNo =
      tokenDeviationFirstHalf.deviation > tokenDeviationSecondHalf.deviation
        ? 0
        : 1;
    const nextInterval = {
      startBlock: blocks[intervalNo],
      endBlock: blocks[intervalNo + 1],
    };

    const deviations =
      intervalNo == 0 ? deviationsFirstHalf : deviationsSecondHalf;
    const tokenDeviation =
      intervalNo == 0 ? tokenDeviationFirstHalf : tokenDeviationSecondHalf;

    logger.info("Deviation: " + tokenDeviation.signedDeviation);

    if (
      deviations.find((d) => d.unique_id === tokenUniqueId)
        .singlePaymentDeviationTooLarge
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
        const matchingXcms = movements.filter(
          (p) =>
            p.timestamp > nextInterval.startBlock.timestamp &&
            p.timestamp <= nextInterval.endBlock.timestamp &&
            p.transfers.some(
              (t) =>
                t.symbol.toUpperCase() === tokenSymbol.toUpperCase() &&
                t.module === "xcm" &&
                !(t as any).asset_unique_id_before_correction,
            ),
        );
        if (matchingXcms.length === 1) {
          const matchingXcmTransfer = (matchingXcms[0]?.transfers ?? []).find(
            (t) => t.symbol.toUpperCase() === tokenSymbol.toUpperCase(),
          );
          if (matchingXcmTransfer) {
            // swap unique_asset_id
            logger.info(
              `Fix: Updating asset in xcm transfer ${matchingXcms[0].extrinsic_index}, ${matchingXcms[0].timestamp}`,
            );
            (matchingXcmTransfer as any).asset_unique_id_before_correction =
              matchingXcmTransfer.asset_unique_id;
            matchingXcmTransfer.asset_unique_id =
              matchingXcmTransfer.asset_unique_id === tokenUniqueId
                ? otherTokenWithSameSymbolSimilarDeviation.unique_id
                : tokenUniqueId;
            return false;
          }
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
      return false;
    }
  }

  private compensateDeviation(
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
      logger.info(
        `Fix: Updating transfer amount in ${matchingMovement.extrinsic_index}`,
      );
      if (matchingTransfer.amount === -deviation) {
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
      logger.info(
        `Fix: Adding transfer to existing tx ${exsitingTx.extrinsic_index}`,
      );
      exsitingTx.transfers.push(transferData);
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

  async determineAdequateMaxDeviations() {
    const goingeckoIds = substraeteToCoingeckoIds.tokens.map(
      (t) => t.coingeckoId,
    );
    const values = await this.fetchCurrentPrices.fetchPrices(
      goingeckoIds,
      "usd",
    );
    const boundaries = [];
    substraeteToCoingeckoIds.tokens.forEach((token) => {
      const value = values[token.coingeckoId]?.usd;
      if (value) {
        boundaries.push({
          symbol: token.token,
          singlePayment: 1 / value,
          max: 10 / value,
        });
      }
    });
    return boundaries;
  }

  async fixErrorsAndMissingData(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: TaxableEvent[],
    unmatchedEvents: SubscanEvent[],
    minDate: number,
    maxDate: number,
  ): Promise<Deviation[]> {
    logger.info(
      `Enter fixErrorsAndMissingData for ${chainInfo.domain}, ${address}`,
    );

    if (portfolioMovements.length === 0) {
      logger.info(
        `Exit fixErrorsAndMissingData for ${chainInfo.domain}, ${address}. No portfolio movements`,
      );
      return [];
    }

    if (isEvmAddress(address)) {
      address =
        (await this.subscanService.mapToSubstrateAccount(
          chainInfo.domain,
          address,
        )) || address;
    }

    const { blockMin, blockMax } = await this.blockTimeService.getMinMaxBlock(
      chainInfo.domain,
      minDate,
      maxDate,
    );

    const acceptedDeviations = await this.determineAdequateMaxDeviations();

    const feeToken =
      await this.portfolioChangeValidationService.findBestFeeToken(
        chainInfo,
        address,
        portfolioMovements,
        acceptedDeviations,
        blockMin,
        blockMax,
      );

    let deviations =
      await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
        chainInfo,
        address,
        portfolioMovements,
        acceptedDeviations,
        blockMin,
        blockMax,
        feeToken,
      );

    const minBlock = await this.subscanApi.fetchBlock(
      chainInfo.domain,
      blockMin,
    );
    const maxBlock = await this.subscanApi.fetchBlock(
      chainInfo.domain,
      blockMax,
    );

    let selectedToken = deviations.find((d) => d.absoluteDeviationTooLarge);

    const maxTurns = 500;
    let counter = 0;
    while (selectedToken && counter <= maxTurns) {
      logger.info(
        {
          deviation: selectedToken.deviation,
          token: selectedToken.symbol,
          uniqueId: selectedToken.unique_id,
        },
        "Fixing errors counter: " + counter + " . Deviation",
      );
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

      deviations =
        await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
          chainInfo,
          address,
          portfolioMovements,
          acceptedDeviations,
          blockMin,
          blockMax,
          feeToken,
        );
      selectedToken = deviations.find((d) => d.absoluteDeviationTooLarge);
      counter++;
    }
    const problematicDeviations = deviations
      .filter((d) => d.absoluteDeviationTooLarge)
      .map((d) => {
        return {
          symbol: d.symbol,
          unique_id: d.unique_id,
          signedDeviation: d.signedDeviation,
        };
      });
    if (counter < maxTurns) {
      logger.info(
        problematicDeviations,
        "fixErrorsAndMissingData: All errors fixed. " + counter + " steps.",
      );
    } else {
      logger.info(
        problematicDeviations,
        "fixErrorsAndMissingData: Stopping after " + counter + " steps",
      );
    }

    logger.info(
      `Exit fixErrorsAndMissingData for ${chainInfo.domain}, ${address}`,
    );
    return deviations;
  }
}
