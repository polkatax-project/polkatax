import { SubscanApi } from "../../blockchain/substrate/api/subscan.api";
import { logger } from "../../logger/logger";
import { PortfolioMovement } from "../model/portfolio-movement";
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

  async validate(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: PortfolioMovement[],
    acceptedDeviations = ACCEPTED_DEVIATIONS,
  ): Promise<Deviation[]> {
    if (portfolioMovements.length === 0) {
      logger.info("No portfolio movements found to validate");
      return [];
    }
    const minBlockNum = portfolioMovements.reduce(
      (curr, next) => Math.min(curr, next.block ?? Number.MAX_SAFE_INTEGER),
      Number.MAX_SAFE_INTEGER,
    );
    const maxBlockNum = portfolioMovements.reduce(
      (curr, next) => Math.max(curr, next.block ?? 0),
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
    const ignoreFees = false;
    for (let tokenInPortfolio of portfolioDifference) {
      let expectedDiff = 0;
      const matchingPortfolioMovements = portfolioMovements.filter(
        (p) =>
          p.timestamp > minBlock.timestamp && p.timestamp <= maxBlock.timestamp,
      );
      if (!ignoreFees && tokenInPortfolio.native) {
        portfolioMovements.forEach((p) => {
          expectedDiff += -(p?.feeUsed ?? 0) - (p?.tip ?? 0); // - (p?.xcmFee ?? 0);
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
          }
        });
      });
      const deviation = Math.abs(tokenInPortfolio.diff - expectedDiff);
      const maxDeviation =
        acceptedDeviations.find((a) => a.symbol === tokenInPortfolio.symbol) ??
        DEFAULT_MAX_DEVIATION;
      const perPayment = tokenInPortfolio.native
        ? deviation / portfolioMovements.length
        : deviation / matchingPortfolioMovements.length;
      deviations.push({
        ...tokenInPortfolio,
        deviation,
        expectedDiff,
        absoluteDeviationTooLarge: Math.abs(deviation) > maxDeviation.max,
        perPaymentDeviationTooLarge:
          Math.abs(perPayment) > maxDeviation.perPayment,
        deviationPerPayment: perPayment,
        numberTx: matchingPortfolioMovements.length,
      });
    }
    return deviations;
  }
}
