import { SubscanApi } from "../blockchain/substrate/api/subscan.api";
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
import { DeviationZoomer } from "./deviation-zoomer";
import * as substraeteToCoingeckoIds from "../../../res/substrate-token-to-coingecko-id.json";
import { selectToken } from "./helper/select-token";
import { TimeoutError } from "../../common/util/with-timeout";
import * as fs from "fs";

export class PortfolioMovementCorrectionService {
  constructor(
    private subscanApi: SubscanApi,
    private portfolioChangeValidationService: PortfolioChangeValidationService,
    private fetchCurrentPrices: FetchCurrentPrices,
    private blockTimeService: BlockTimeService,
    private subscanService: SubscanService,
    private deviationZoomer: DeviationZoomer,
  ) {}

  async determineAdequateMaxDeviations() {
    const goingeckoIds = substraeteToCoingeckoIds.tokens.map(
      (t) => t.coingeckoId,
    );
    const values = await this.fetchCurrentPrices.fetchPrices(
      goingeckoIds,
      "usd",
    );
    return substraeteToCoingeckoIds.tokens
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
  }

  async determineMinMaxBlock(
    chainInfo: { domain: string; token: string },
    portfolioMovements: TaxableEvent[],
    minDate: number,
    maxDate: number,
  ): Promise<{ blockMin: number; blockMax: number }> {
    const FIVE_MINUTES = 5 * 60 * 60 * 1000;
    // assuming ascending order by timestamp
    const minBlockInData = (portfolioMovements[0] as PortfolioMovement)?.block;
    const maxBlockInData = (
      portfolioMovements[portfolioMovements.length - 1] as PortfolioMovement
    )?.block;
    const firstPortfolioMovmenetCloseToMinDate =
      Math.abs(minDate - portfolioMovements[0].timestamp) < FIVE_MINUTES;
    const lastPortfolioMovmenetCloseToMaxDate =
      Math.abs(
        maxDate - portfolioMovements[portfolioMovements.length - 1].timestamp,
      ) < FIVE_MINUTES;

    const blockMin =
      minBlockInData > 0 && firstPortfolioMovmenetCloseToMinDate
        ? minBlockInData - 1
        : await this.blockTimeService.findBlock(
            chainInfo.domain,
            minDate + FIVE_MINUTES,
            FIVE_MINUTES,
          );
    const blockMax =
      maxBlockInData > 0 && lastPortfolioMovmenetCloseToMaxDate
        ? maxBlockInData
        : await this.blockTimeService.findBlock(
            chainInfo.domain,
            maxDate - FIVE_MINUTES,
            FIVE_MINUTES,
          );
    return { blockMin, blockMax };
  }

  private async calculateDeviationWithRetry(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: TaxableEvent[],
    acceptedDeviations,
    blockMin: number,
    blockMax: number,
    feeToken: string | undefined,
    maxRetry = 2,
  ) {
    let attempt = 0;
    try {
      const deviations =
        await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
          chainInfo,
          address,
          portfolioMovements,
          acceptedDeviations,
          blockMin,
          blockMax,
          feeToken,
        );
      return deviations;
    } catch (error) {
      if (error instanceof TimeoutError && attempt <= maxRetry) {
        attempt++;
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
          feeToken,
          maxRetry,
        );
      } else {
        throw error;
      }
    }
  }

  async fixErrorsValidateEachBlock(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: TaxableEvent[],
    acceptedDeviations: any,
    blockMin: number,
    blockMax: number,
    feeToken: string | undefined,
  ) {
    logger.info(
      `Enter fixErrorsValidateEachBlock for ${chainInfo.domain}, ${address}`,
    );
    const blocks = new Set<number>();
    for (const p of portfolioMovements as PortfolioMovement[]) {
      if (
        p.block !== undefined &&
        p.block !== null &&
        p.label !== "Staking reward" &&
        p.label !== "Staking slashed"
      ) {
        blocks.add(p.block);
        blocks.add(p.block - 1);
      }
    }

    const blocksOfInterest = Array.from(blocks).sort((a, b) => a - b);

    await this.calculateDeviationWithRetry(
      chainInfo,
      address,
      portfolioMovements,
      acceptedDeviations,
      blockMin,
      blockMax,
      feeToken,
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
        feeToken,
      );

      if (deviations.find((d) => d.singlePaymentDeviationTooLarge)) {
        logger.info(`Found deviations in block ${endBlock.block_num}`);
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
            feeToken,
          );
          j = 0;
          continue;
        }

        this.deviationZoomer.compensateDeviation(
          address,
          portfolioMovements as PortfolioMovement[],
          [],
          selectedToken,
          deviations,
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
    portfolioMovements: TaxableEvent[],
    minDate: number,
    maxDate: number,
  ): Promise<Deviation[]> {
    logger.info(
      `Enter fixErrorsAndMissingData for ${chainInfo.domain}, ${address}`,
    );

    if (portfolioMovements.length === 0) {
      logger.info(`Exit fixErrorsAndMissingData. No portfolio movements`);
      return [];
    }

    if (isEvmAddress(address)) {
      address =
        (await this.subscanService.mapToSubstrateAccount(
          chainInfo.domain,
          address,
        )) || address;
    }

    const { blockMin, blockMax } = await this.determineMinMaxBlock(
      chainInfo,
      portfolioMovements,
      minDate,
      maxDate,
    );

    const acceptedDeviations = await this.determineAdequateMaxDeviations();

    try {
      const feeToken =
        await this.portfolioChangeValidationService.findBestFeeToken(
          chainInfo,
          address,
          portfolioMovements,
          acceptedDeviations,
          blockMin,
          blockMax,
        );

      const deviations = await this.calculateDeviationWithRetry(
        chainInfo,
        address,
        portfolioMovements,
        acceptedDeviations,
        blockMin,
        blockMax,
        feeToken,
      );

      if (
        process.env["USE_DATA_PLATFORM_API"] === "true" &&
        (chainInfo.domain === "polkadot" ||
          chainInfo.domain === "kusama" ||
          chainInfo.domain === "enjin")
      ) {
        logger.info(
          `Exit fixErrorsAndMissingData. No correction was done due to working with aggregated data.`,
        );
        return deviations;
      }

      if (!deviations.find((d) => d.absoluteDeviationTooLarge)) {
        logger.info(
          `Exit fixErrorsAndMissingData. No Meaningful deviations found.`,
        );
        return deviations;
      }

      if (process.env["WRITE_RESULTS_TO_DISK"] === "true") {
        fs.writeFileSync(
          `./${chainInfo.domain}-${address}-deviations.json`,
          JSON.stringify(deviations, null, 2),
        );
      }

      await this.fixErrorsValidateEachBlock(
        chainInfo,
        address,
        portfolioMovements,
        acceptedDeviations,
        blockMin,
        blockMax,
        feeToken,
      );

      if (process.env["WRITE_RESULTS_TO_DISK"] === "true") {
        fs.writeFileSync(
          `./${chainInfo.domain}-${address}-linear-fix.json`,
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
        feeToken,
      );

      if (process.env["WRITE_RESULTS_TO_DISK"] === "true") {
        fs.writeFileSync(
          `./${chainInfo.domain}-${address}-recursive-fix.json`,
          JSON.stringify(portfolioMovements, null, 2),
        );
        fs.writeFileSync(
          `./${chainInfo.domain}-${address}-deviations-fixed.json`,
          JSON.stringify(deviationsAfterFix, null, 2),
        );
      }

      logger.info(
        `Exit fixErrorsAndMissingData for ${chainInfo.domain}, ${address}`,
      );
    } finally {
      this.portfolioChangeValidationService.disconnectApi();
    }
  }

  async fixErrorsAndMissingDataRecursively(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: TaxableEvent[],
    acceptedDeviations: any,
    blockMin: number,
    blockMax: number,
    feeToken: string | undefined,
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
          [],
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
            feeToken,
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
