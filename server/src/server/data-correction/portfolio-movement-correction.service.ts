import { SubscanApi } from "../blockchain/substrate/api/subscan.api";
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
import { FetchCurrentPrices } from "./fetch-crypto-prices";
import { BlockTimeService } from "../blockchain/substrate/services/block-time.service";
import { isEvmAddress } from "../data-aggregation/helper/is-evm-address";
import { SubscanService } from "../blockchain/substrate/api/subscan.service";
import { DeviationZoomer } from "./deviation-zoomer";
import * as substraeteToCoingeckoIds from "../../../res/substrate-token-to-coingecko-id.json";
import { selectToken } from "./helper/select-token";

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

  async fixErrorsAndMissingData(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: TaxableEvent[],
    unmatchedEvents: SubscanEvent[],
    minDate: number,
    maxDate: number,
  ): Promise<Deviation[]> {
    try {
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

      const FIVE_MINUTES = 5 * 60 * 60 * 1000;
      // assuming ascending order by timestamp
      const minBlockInData = (portfolioMovements[0] as PortfolioMovement)
        ?.block;
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

      const acceptedDeviations = await this.determineAdequateMaxDeviations();

      if (
        process.env["USE_DATA_PLATFORM_API"] === "true" &&
        (chainInfo.domain === "polkadot" ||
          chainInfo.domain === "kusama" ||
          chainInfo.domain === "enjin")
      ) {
        let deviations =
          await this.portfolioChangeValidationService.calculateDeviationFromExpectation(
            chainInfo,
            address,
            portfolioMovements,
            acceptedDeviations,
            blockMin,
            blockMax,
            chainInfo.token,
          );
        logger.info(
          `Exit fixErrorsAndMissingData. No correction was done due to working with aggregated data.`,
        );
        return deviations;
      }

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

      let selectedToken = selectToken(deviations);

      const maxTurns = 500;
      let counter = 0;

      while (selectedToken && counter <= maxTurns) {
        logger.info(
          {
            deviation: selectedToken.deviation,
            token: selectedToken.symbol,
            uniqueId: selectedToken.unique_id,
          },
          "Fixing errors counter: " + counter,
        );

        await this.deviationZoomer.zoomInAndFix(
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

        selectedToken = selectToken(deviations);
        counter++;
      }

      const problematicDeviations = deviations
        .filter((d) => d.absoluteDeviationTooLarge)
        .map((d) => ({
          symbol: d.symbol,
          unique_id: d.unique_id,
          signedDeviation: d.signedDeviation,
        }));

      if (counter < maxTurns) {
        logger.info(
          problematicDeviations,
          `All errors fixed in ${counter} steps`,
        );
      } else {
        logger.info(problematicDeviations, `Stopping after ${counter} steps`);
      }

      logger.info(
        `Exit fixErrorsAndMissingData for ${chainInfo.domain}, ${address}`,
      );
      return deviations;
    } finally {
      this.portfolioChangeValidationService.disconnectApi();
    }
  }
}
