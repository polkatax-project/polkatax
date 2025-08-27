import { WS_CHAIN_ENDPOINTS } from "../../blockchain/substrate/api/polkadot-api";
import { SubscanApi } from "../../blockchain/substrate/api/subscan.api";
import { Transfer } from "../../blockchain/substrate/model/raw-transfer";
import { logger } from "../../logger/logger";
import { PortfolioMovement, TaxableEvent } from "../model/portfolio-movement";
import { PortfolioDifferenceService } from "./portfolio-difference.service";

const DEFAULT_MAX_DEVIATION = {
  perPayment: 0.02,
  max: 0.1,
};

const ACCEPTED_DEVIATIONS = [
  {
    symbol: "DOT",
    perPayment: 0.5,
    max: 2,
  },
  {
    symbol: "TBTC",
    perPayment: 0.001,
    max: 0.001,
  },
  {
    symbol: "WETH",
    perPayment: 0.01,
    max: 0.01,
  },
  {
    symbol: "KSM",
    perPayment: 0.1,
    max: 1,
  },
  {
    symbol: "USDT",
    perPayment: 0.1,
    max: 1,
  },
  {
    symbol: "ASTR",
    perPayment: 1,
    max: 100,
  },
  {
    symbol: "HDX",
    perPayment: 3,
    max: 200,
  },
  {
    symbol: "PHA",
    perPayment: 1,
    max: 100,
  },
  {
    symbol: "MYTH",
    perPayment: 0.02,
    max: 10,
  },
  {
    symbol: "EWT",
    perPayment: 0.01,
    max: 1,
  },
  {
    symbol: "BNC",
    perPayment: 0.3,
    max: 2,
  },
];

export interface Deviation {
  symbol: string;
  unique_id: string;
  decimals: number;
  asset_id: number;
  diff: number;
  expectedDiff: number;
  deviation: number;
  absoluteDeviationTooLarge: boolean;
  perPaymentDeviationTooLarge: boolean;
  deviationPerPayment: number;
  numberTx: number;
}

export class PortfolioChangeValidationService {
  constructor(
    private portfolioDifferenceSerivce: PortfolioDifferenceService,
    private subscanApi: SubscanApi,
  ) {}

  async calculateDeviationFromExpectation(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: TaxableEvent[],
    acceptedDeviations = ACCEPTED_DEVIATIONS,
    minBlockNum?: number,
    maxBlockNum?: number,
  ): Promise<Deviation[]> {
    logger.info(
      `Enter PortfolioChangeValidationService.validate for ${chainInfo.domain} and wallet ${address}`,
    );

    if (!Object.keys(WS_CHAIN_ENDPOINTS).includes(chainInfo.domain)) {
      logger.info(
        `Exit PortfolioChangeValidationService.validate: chain ${chainInfo.domain} not supported.`,
      );
      return [];
    }

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
    const [minBlock, maxBlock] = await Promise.all([
      this.subscanApi.fetchBlock(chainInfo.domain, minBlockNum),
      this.subscanApi.fetchBlock(chainInfo.domain, maxBlockNum),
    ]);
    const portfolioDifference =
      await this.portfolioDifferenceSerivce.fetchPortfolioDifference(
        chainInfo,
        address,
        minBlockNum,
        maxBlockNum,
      );
    const deviations = [];
    const ignoreFees = [
      "hydration",
      "basilisk",
      "bifrost",
      "assethub-polkadot",
      "assethub-kusama",
    ].includes(chainInfo.domain);

    const portfolioTokenIds = portfolioDifference.map(d => d.unique_id )
    const tokenIdsNotInPortfolio = []
    const tokensNotInPortfolio = []
    portfolioMovements.forEach(p => p.transfers.forEach((t: Transfer) => {
      if (!portfolioTokenIds.includes(t.asset_unique_id) && !tokenIdsNotInPortfolio.includes(t)) {
        tokenIdsNotInPortfolio.push(t)
        tokensNotInPortfolio.push({ symbol: t.symbol, asset_unique_id: t.asset_unique_id, diff: 0, native: t.asset_unique_id === chainInfo.token })
      }
    }))
    const allTokens = portfolioDifference.concat(tokensNotInPortfolio)

    const matchingPortfolioMovements = portfolioMovements.filter(
      (p) =>
        p.timestamp > minBlock.timestamp && p.timestamp <= maxBlock.timestamp,
    );
      
    for (let tokenInPortfolio of allTokens) {
      let expectedDiff = 0;
      let transferCounter = 0;

      if (!ignoreFees && tokenInPortfolio.native) {
        matchingPortfolioMovements.forEach((p) => {
          expectedDiff +=
            -((p as PortfolioMovement)?.feeUsed ?? 0) -
            ((p as PortfolioMovement)?.tip ?? 0); // - (p?.xcmFee ?? 0);
        });
      }
      matchingPortfolioMovements.forEach((p) => {
        p.transfers.forEach((t) => {
          if (
            t.asset_unique_id === tokenInPortfolio.unique_id ||
            (t.symbol.toUpperCase() === tokenInPortfolio.symbol.toUpperCase() &&
              t.module === "xcm")
          ) {
            expectedDiff += t?.amount ?? 0;
            transferCounter++;
          }
        });
      });
      const deviation = Math.abs(tokenInPortfolio.diff - expectedDiff);
      const maxDeviation =
        acceptedDeviations.find((a) => a.symbol === tokenInPortfolio.symbol) ??
        DEFAULT_MAX_DEVIATION;
      const perPayment = tokenInPortfolio.native ? deviation / matchingPortfolioMovements.length : deviation / transferCounter;
      deviations.push({
        ...tokenInPortfolio,
        deviation,
        expectedDiff,
        absoluteDeviationTooLarge: Math.abs(deviation) > maxDeviation.max,
        perPaymentDeviationTooLarge:
          Math.abs(perPayment) > maxDeviation.perPayment,
        deviationPerPayment: isNaN(perPayment) ? 0 : perPayment,
        numberTx: matchingPortfolioMovements.length,
      });
    }

    logger.info(
      `Exit PortfolioChangeValidationService.validate for ${chainInfo.domain} and wallet ${address}`,
    );
    return deviations;
  }
}
