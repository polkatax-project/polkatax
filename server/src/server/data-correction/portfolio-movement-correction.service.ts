import { SubscanApi } from "../blockchain/substrate/api/subscan.api";
import { PortfolioMovement } from "../data-aggregation/model/portfolio-movement";
import { logger } from "../logger/logger";
import { PortfolioChangeValidationService } from "./portfolio-change-validation.service";
import { FetchCurrentPrices } from "./fetch-crypto-prices";
import { BlockTimeService } from "../blockchain/substrate/services/block-time.service";
import { isEvmAddress } from "../data-aggregation/helper/is-evm-address";
import { SubscanService } from "../blockchain/substrate/api/subscan.service";
import { DeviationZoomer } from "./deviation-zoomer";
import * as substraeteToCoingeckoIds from "../../../res/substrate-token-to-coingecko-id.json";
import { selectToken } from "./helper/select-token";
import { TimeoutError } from "../../common/util/with-timeout";
import * as fs from "fs";
import { Deviation } from "./model/deviation";
import { DEVIATION_LIMITS } from "./const/deviation-limits";
import { DeviationLimit } from "./model/deviation-limit";
import { determineMinMaxBlock } from "../data-aggregation/helper/determine-min-max-block";

export class PortfolioMovementCorrectionService {
  constructor(
    private subscanApi: SubscanApi,
    private portfolioChangeValidationService: PortfolioChangeValidationService,
    private fetchCurrentPrices: FetchCurrentPrices,
    private blockTimeService: BlockTimeService,
    private subscanService: SubscanService,
    private deviationZoomer: DeviationZoomer,
  ) {}

  async determineAdequateMaxDeviations(): Promise<DeviationLimit[]> {
    const goingeckoIds = substraeteToCoingeckoIds.tokens.map(
      (t) => t.coingeckoId,
    );
    const values = await this.fetchCurrentPrices.fetchPrices(
      goingeckoIds,
      "usd",
    );
    const deviationLimits = await substraeteToCoingeckoIds.tokens
      .map((token) => {
        const value = values[token.coingeckoId]?.usd;
        if (!value) return null;
        return {
          symbol: token.token,
          singlePayment: 1 / value,
          max: 10 / value,
        };
      })
      .filter(Boolean);

    DEVIATION_LIMITS.forEach((d) => {
      if (!deviationLimits.find((l) => d.symbol === l.symbol)) {
        deviationLimits.push(d);
      }
    });
    return deviationLimits;
  }

  private async calculateDeviationWithRetry(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: PortfolioMovement[],
    acceptedDeviations,
    blockMin: number,
    blockMax: number,
    maxRetry = 2,
    attempt = 0,
  ) {
    try {
      const deviations =
        await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
          chainInfo,
          address,
          portfolioMovements,
          acceptedDeviations,
          blockMin,
          blockMax,
        );
      return deviations;
    } catch (error) {
      if (error instanceof TimeoutError && attempt <= maxRetry) {
        logger.info(
          `Timeout when calculating deviation from expection. Will retry after 3 min.`,
        );
        this.portfolioChangeValidationService.disconnectApi();
        await new Promise((resolve) => setTimeout(resolve, 180_000));
        return this.calculateDeviationWithRetry(
          chainInfo,
          address,
          portfolioMovements,
          acceptedDeviations,
          blockMin,
          blockMax,
          maxRetry,
          attempt + 1,
        );
      } else {
        throw error;
      }
    }
  }

  async fixErrorsValidateEachBlock(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: PortfolioMovement[],
    acceptedDeviations: DeviationLimit[],
  ) {
    logger.info(
      `Enter fixErrorsValidateEachBlock for ${chainInfo.domain}, ${address}.}`,
    );

    const blocks = new Set<number>();
    const timestampsAlreadyCovered = [];
    const timestamps = [];

    for (const p of portfolioMovements as PortfolioMovement[]) {
      if (
        p.block !== undefined &&
        p.block !== null &&
        p.label !== "Staking reward" &&
        p.label !== "Staking slashed"
      ) {
        blocks.add(p.block);
        blocks.add(p.block - 1);
        timestampsAlreadyCovered.push(p.timestamp);
      }
      if (!p.block && !timestampsAlreadyCovered.includes(p.timestamp)) {
        timestamps.push(p.timestamp);
      }
    }

    const blocksFromTimestamps = await Promise.all(
      timestamps.map(async (t) => ({
        block: await this.subscanApi.fetchBlock(
          chainInfo.domain,
          undefined,
          Math.floor(t / 1000),
        ),
        timestamp: t,
      })),
    );
    blocksFromTimestamps.forEach(({ timestamp, block }) => {
      if (block.block_num) {
        blocks.add(block.block_num);
        if (block.timestamp >= timestamp) {
          blocks.add(block.block_num - 1);
        } else {
          blocks.add(block.block_num + 1);
        }
      }
    });

    const blocksOfInterest = Array.from(blocks).sort((a, b) => a - b);

    logger.info(
      `fixErrorsValidateEachBlock iterating over ${blocksOfInterest.length} blocks for ${chainInfo.domain}, ${address}.}`,
    );

    for (let idx = 0; idx < blocksOfInterest.length - 1; idx++) {
      const blockMin = blocksOfInterest[idx];
      const blockMax = blocksOfInterest[idx + 1];
      if (blockMax - blockMin > 1) {
        continue;
      }

      const startBlock = await this.subscanApi.fetchBlock(
        chainInfo.domain,
        blockMin,
      );
      const endBlock = await this.subscanApi.fetchBlock(
        chainInfo.domain,
        blockMax,
      );

      let deviations = await this.calculateDeviationWithRetry(
        chainInfo,
        address,
        portfolioMovements.filter(
          (p) =>
            p.timestamp > startBlock.timestamp &&
            p.timestamp <= endBlock.timestamp,
        ),
        acceptedDeviations,
        blockMin,
        blockMax,
      );

      if (deviations.find((d) => d.singlePaymentDeviationTooLarge)) {
        logger.info(
          `Found deviations in block ${endBlock.block_num} for ${chainInfo.domain} and ${address}`,
        );
      }
      for (let j = 0; j < deviations.length; j++) {
        const selectedToken = deviations[j];
        if (!selectedToken.singlePaymentDeviationTooLarge) {
          continue;
        }
        if (
          this.deviationZoomer.fixSymbolConfusion(
            deviations,
            selectedToken,
            { startBlock, endBlock },
            portfolioMovements as PortfolioMovement[],
          )
        ) {
          deviations = await this.calculateDeviationWithRetry(
            chainInfo,
            address,
            portfolioMovements.filter(
              (p) =>
                p.timestamp > startBlock.timestamp &&
                p.timestamp <= endBlock.timestamp,
            ),
            acceptedDeviations,
            blockMin,
            blockMax,
          );
          j = 0;
          continue;
        }

        this.deviationZoomer.compensateDeviation(
          address,
          portfolioMovements as PortfolioMovement[],
          selectedToken,
          startBlock,
          endBlock,
        );
      }
    }
    logger.info(
      `Exit fixErrorsValidateEachBlock for ${chainInfo.domain}, ${address}`,
    );
  }

  async fixErrorsAndMissingData(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: PortfolioMovement[],
    minDate: number,
    maxDate: number,
  ): Promise<Deviation[]> {
    logger.info(
      `Enter fixErrorsAndMissingData for ${chainInfo.domain}, ${address}`,
    );

    try {
      if (portfolioMovements.length === 0) {
        logger.info(
          `Exit fixErrorsAndMissingData. No portfolio movements for ${chainInfo.domain}, ${address}`,
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

      const { blockMin, blockMax } = await determineMinMaxBlock(
        chainInfo,
        portfolioMovements,
        minDate,
        maxDate,
        this.blockTimeService,
      );

      const acceptedDeviations = await this.determineAdequateMaxDeviations();

      const deviations = await this.calculateDeviationWithRetry(
        chainInfo,
        address,
        portfolioMovements,
        acceptedDeviations,
        blockMin,
        blockMax,
      );

      if (!deviations.find((d) => d.absoluteDeviationTooLarge)) {
        logger.info(
          `Exit fixErrorsAndMissingData. No Meaningful deviations found.`,
        );
        return deviations;
      } else {
        logger.warn(
          `Exit fixErrorsAndMissingData. Deviations found for ${chainInfo.domain} and ${address}`,
        );
      }

      if (process.env["WRITE_RESULTS_TO_DISK"] === "true") {
        fs.writeFileSync(
          `./logs/${chainInfo.domain}-${address}-deviations.json`,
          JSON.stringify(deviations, null, 2),
        );
      }

      await this.fixErrorsValidateEachBlock(
        chainInfo,
        address,
        portfolioMovements,
        acceptedDeviations,
      );

      if (process.env["WRITE_RESULTS_TO_DISK"] === "true") {
        fs.writeFileSync(
          `./logs/${chainInfo.domain}-${address}-linear-fix.json`,
          JSON.stringify(portfolioMovements, null, 2),
        );
      }

      const deviationsAfterFix = await this.fixErrorsAndMissingDataRecursively(
        chainInfo,
        address,
        portfolioMovements,
        acceptedDeviations,
        blockMin,
        blockMax,
      );

      if (process.env["WRITE_RESULTS_TO_DISK"] === "true") {
        fs.writeFileSync(
          `./logs/${chainInfo.domain}-${address}-recursive-fix.json`,
          JSON.stringify(portfolioMovements, null, 2),
        );
        fs.writeFileSync(
          `./logs/${chainInfo.domain}-${address}-deviations-fixed.json`,
          JSON.stringify(deviationsAfterFix, null, 2),
        );
      }

      logger.info(
        `Exit fixErrorsAndMissingData for ${chainInfo.domain}, ${address}`,
      );
      return deviationsAfterFix;
    } finally {
      this.portfolioChangeValidationService.disconnectApi();
    }
  }

  async fixErrorsAndMissingDataRecursively(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: PortfolioMovement[],
    acceptedDeviations: DeviationLimit[],
    blockMin: number,
    blockMax: number,
  ): Promise<Deviation[]> {
    logger.info(
      `Enter fixErrorsAndMissingDataRecursively for ${chainInfo.domain}, ${address}`,
    );
    let deviations =
      await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
        chainInfo,
        address,
        portfolioMovements,
        acceptedDeviations,
        blockMin,
        blockMax,
      );

    const minBlock = await this.subscanApi.fetchBlock(
      chainInfo.domain,
      blockMin,
    );
    const maxBlock = await this.subscanApi.fetchBlock(
      chainInfo.domain,
      blockMax,
    );

    let selectedToken = selectToken(deviations);

    const maxTurns = 500;
    let counter = 0;
    let timeoutErrors = 0;
    const excludeTokens = [];

    while (selectedToken && counter <= maxTurns) {
      try {
        logger.info(
          {
            deviation: selectedToken.deviation,
            token: selectedToken.symbol,
            uniqueId: selectedToken.unique_id,
          },
          `Fixing errors counter for ${chainInfo.domain} and ${address}: ${counter}`,
        );

        const gain = await this.deviationZoomer.zoomInAndFix(
          chainInfo,
          address,
          portfolioMovements as PortfolioMovement[],
          acceptedDeviations,
          minBlock,
          maxBlock,
          selectedToken.symbol,
          selectedToken.unique_id,
        );

        if (Math.abs(gain) < selectedToken.maxDeviationSinglePayment) {
          logger.info(
            `fixErrorsAndMissingDataRecursively excluding token ${selectedToken.symbol}. Chain ${chainInfo.domain}`,
          );
          excludeTokens.push(selectedToken.unique_id);
        }

        deviations =
          await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
            chainInfo,
            address,
            portfolioMovements,
            acceptedDeviations,
            blockMin,
            blockMax,
          );

        selectedToken = selectToken(deviations, excludeTokens);
        if (selectedToken) {
          logger.info(
            `PortfolioMovementCorrectionService for ${chainInfo.domain} and ${address} next token: ` +
              selectedToken.symbol,
          );
        }
        counter++;
      } catch (error) {
        if (error instanceof TimeoutError) {
          logger.warn(
            `Timeout when calling node WS for ${chainInfo.domain} and ${address}. Pausing 3 min.`,
          );
          if (timeoutErrors > 3) {
            logger.warn(`Several timeout errors received. Rethrowing.`);
            throw error;
          }
          this.portfolioChangeValidationService.disconnectApi();
          await new Promise((resolve) => setTimeout(resolve, 180_000));
        } else {
          throw error;
        }
      }
    }

    if (counter < maxTurns) {
      logger.info(
        `Exit fixErrorsAndMissingDataRecursively: All errors fixed in ${counter} steps for ${chainInfo.domain} and ${address}`,
      );
    } else {
      logger.info(
        `Exit fixErrorsAndMissingDataRecursively: Stopping after ${counter} steps when fixing ${chainInfo.domain}, ${address}`,
      );
    }
    return deviations;
  }
}
