import { SubscanApi } from "../blockchain/substrate/api/subscan.api";
import { Block } from "../blockchain/substrate/model/block";
import { Transfer } from "../blockchain/substrate/model/raw-transfer";
import {
  PortfolioMovement,
  TaxableEvent,
} from "../data-aggregation/model/portfolio-movement";
import {
  PortfolioDifference,
  PortfolioDifferenceService,
} from "./portfolio-difference.service";
import * as substrateNodesWsEndpoints from "../../../res/substrate-nodes-ws-endpoints.json"

const DEFAULT_MAX_ALLOWED_DEVIATION = {
  singlePayment: 1,
  max: 3,
};

const ACCEPTED_DEVIATIONS = [
  {
    symbol: "DOT",
    singlePayment: 0.5,
    max: 2,
  },
  {
    symbol: "TBTC",
    singlePayment: 0.001,
    max: 0.001,
  },
  {
    symbol: "WETH",
    singlePayment: 0.01,
    max: 0.01,
  },
  {
    symbol: "KSM",
    singlePayment: 0.1,
    max: 1,
  },
  {
    symbol: "USDT",
    singlePayment: 0.5,
    max: 2.5,
  },
  {
    symbol: "ASTR",
    singlePayment: 1,
    max: 100,
  },
  {
    symbol: "HDX",
    singlePayment: 1,
    max: 200,
  },
  {
    symbol: "PHA",
    singlePayment: 1,
    max: 100,
  },
  {
    symbol: "MYTH",
    singlePayment: 1,
    max: 10,
  },
  {
    symbol: "EWT",
    singlePayment: 1,
    max: 2,
  },
  {
    symbol: "BNC",
    singlePayment: 1,
    max: 10,
  },
  {
    symbol: "INTR",
    singlePayment: 1,
    max: 100,
  },
  {
    symbol: "GLMR",
    singlePayment: 1,
    max: 10,
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
  signedDeviation: number;
  absoluteDeviationTooLarge: boolean;
  singlePaymentDeviationTooLarge: boolean;
  numberTx: number;
  maxAllowedDeviation: number;
}

export class PortfolioChangeValidationService {
  constructor(
    private portfolioDifferenceSerivce: PortfolioDifferenceService,
    private subscanApi: SubscanApi,
  ) {}

  private async fetchPortfolioDifferences(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: TaxableEvent[],
    minBlockNum?: number,
    maxBlockNum?: number,
  ): Promise<
    | {
        portfolioDifferences: PortfolioDifference[];
        minBlock?: Block;
        maxBlock?: Block;
      }
    | undefined
  > {
    if (!Object.keys(substrateNodesWsEndpoints).includes(chainInfo.domain)) {
      return {
        portfolioDifferences: [],
        minBlock: undefined,
        maxBlock: undefined,
      };
    }

    if (maxBlockNum === undefined && portfolioMovements.length === 0) {
      return {
        portfolioDifferences: [],
        minBlock: undefined,
        maxBlock: undefined,
      };
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
    const portfolioDifferences: PortfolioDifference[] =
      await this.portfolioDifferenceSerivce.fetchPortfolioDifference(
        chainInfo,
        address,
        minBlockNum,
        maxBlockNum,
      );

    return { portfolioDifferences, minBlock, maxBlock };
  }

  async calculateDeviationFromExpectation(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: TaxableEvent[],
    acceptedDeviations = ACCEPTED_DEVIATIONS,
    minBlockNum?: number,
    maxBlockNum?: number,
    feeToken?: string,
  ): Promise<Deviation[]> {
    if (!Object.keys(substrateNodesWsEndpoints).includes(chainInfo.domain)) {
      return [];
    }

    if (maxBlockNum === undefined && portfolioMovements.length === 0) {
      return [];
    }

    const { portfolioDifferences, minBlock, maxBlock } =
      await this.fetchPortfolioDifferences(
        chainInfo,
        address,
        portfolioMovements,
        minBlockNum,
        maxBlockNum,
      );

    if (portfolioDifferences.length === 0) {
      return [];
    }

    return this.calculateDeviation(
      chainInfo,
      portfolioMovements,
      portfolioDifferences,
      acceptedDeviations,
      minBlock,
      maxBlock,
      feeToken,
    );
  }

  async findBestFeeToken(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: TaxableEvent[],
    acceptedDeviations = ACCEPTED_DEVIATIONS,
    minBlockNum?: number,
    maxBlockNum?: number,
  ): Promise<string | undefined> {
    if (!Object.keys(substrateNodesWsEndpoints).includes(chainInfo.domain)) {
      return;
    }
    if (maxBlockNum === undefined && portfolioMovements.length === 0) {
      return;
    }
    const { portfolioDifferences, minBlock, maxBlock } =
      await this.fetchPortfolioDifferences(
        chainInfo,
        address,
        portfolioMovements,
        minBlockNum,
        maxBlockNum,
      );

    if (portfolioDifferences.length === 0) {
      return;
    }
    let feeTokens = [chainInfo.token, undefined];

    let minDeviation = Number.MAX_SAFE_INTEGER;
    let minFeeToken = undefined;
    for (let feeToken of feeTokens) {
      const deviations = await this.calculateDeviation(
        chainInfo,
        portfolioMovements,
        portfolioDifferences,
        acceptedDeviations,
        minBlock,
        maxBlock,
        feeToken,
      );
      const total = deviations.reduce((curr, d) => curr + d.deviation, 0);
      if (total < minDeviation) {
        minFeeToken = feeToken;
        minDeviation = total;
      }
    }
    return minFeeToken;
  }

  private filterMovementsWithinRange(
    portfolioMovements: TaxableEvent[],
    minBlock: Block,
    maxBlock: Block,
  ): TaxableEvent[] {
    return portfolioMovements.filter(
      (p) =>
        p.timestamp > minBlock.timestamp && p.timestamp <= maxBlock.timestamp,
    );
  }

  private async calculateExpectedDiffForToken(
    chainInfo: { domain: string; token: string },
    tokenInPortfolio: PortfolioDifference,
    matchingPortfolioMovements: TaxableEvent[],
    feeToken?: string,
  ): Promise<number> {
    let expectedDiff = 0;

    if (feeToken === tokenInPortfolio.unique_id) {
      const totalFees = matchingPortfolioMovements.reduce(
        (curr, p) =>
          curr +
          ((p as PortfolioMovement)?.feeUsed ?? 0) +
          ((p as PortfolioMovement)?.tip ?? 0), // - (p?.xcmFee ?? 0);
        0,
      );
      const nativeToken = await this.subscanApi.fetchNativeToken(
        chainInfo.domain,
      );
      if (feeToken !== chainInfo.token) {
        throw new Error("Only native token accepted as fee token for now!");
      }
      expectedDiff -= totalFees / 10 ** nativeToken.token_decimals;
    }

    matchingPortfolioMovements.forEach((p) => {
      p.transfers.forEach((t) => {
        if (t.asset_unique_id === tokenInPortfolio.unique_id) {
          expectedDiff += t?.amount ?? 0;
        }
      });
    });

    return expectedDiff;
  }

  private evaluateDeviationAgainstThreshold(
    tokenInPortfolio: PortfolioDifference,
    expectedDiff: number,
    acceptedDeviations: typeof ACCEPTED_DEVIATIONS,
    numberTx: number,
  ): Deviation {
    const signedDeviation = tokenInPortfolio.diff - expectedDiff;
    const deviation = Math.abs(signedDeviation);

    const maxAllowedDeviation =
      acceptedDeviations.find(
        (a) => a.symbol.toUpperCase() === tokenInPortfolio.symbol.toUpperCase(),
      ) ??
      ACCEPTED_DEVIATIONS.find(
        (a) => a.symbol.toUpperCase() === tokenInPortfolio.symbol.toUpperCase(),
      ) ??
      DEFAULT_MAX_ALLOWED_DEVIATION;

    return {
      ...tokenInPortfolio,
      deviation,
      signedDeviation,
      expectedDiff,
      absoluteDeviationTooLarge: Math.abs(deviation) > maxAllowedDeviation.max,
      singlePaymentDeviationTooLarge:
        Math.abs(deviation) > maxAllowedDeviation.singlePayment,
      numberTx,
      maxAllowedDeviation: maxAllowedDeviation.max,
    };
  }

  async calculateDeviation(
    chainInfo: { domain: string; token: string },
    portfolioMovements: TaxableEvent[],
    portfolioDifferences: PortfolioDifference[],
    acceptedDeviations = ACCEPTED_DEVIATIONS,
    minBlock: Block,
    maxBlock: Block,
    feeToken?: string,
  ): Promise<Deviation[]> {
    const deviations: Deviation[] = [];

    const portfolioTokenIds = portfolioDifferences.map((d) => d.unique_id);
    const tokenIdsNotInPortfolio: string[] = [];
    const tokensNotInPortfolio: Partial<PortfolioDifference>[] = [];

    portfolioMovements.forEach((p) =>
      p.transfers
        .filter((t) => t.asset_unique_id)
        .forEach((t: Transfer) => {
          if (
            !portfolioTokenIds.includes(t.asset_unique_id) &&
            !tokenIdsNotInPortfolio.includes(t.asset_unique_id)
          ) {
            tokenIdsNotInPortfolio.push(t.asset_unique_id);
            tokensNotInPortfolio.push({
              symbol: t.symbol,
              unique_id: t.asset_unique_id,
              diff: 0,
              native: t.asset_unique_id === chainInfo.token,
            });
          }
        }),
    );

    const allTokens = portfolioDifferences.concat(
      tokensNotInPortfolio as PortfolioDifference[],
    );

    const matchingPortfolioMovements = this.filterMovementsWithinRange(
      portfolioMovements,
      minBlock,
      maxBlock,
    );

    // compute deviations per token
    for (const tokenInPortfolio of allTokens) {
      const expectedDiff = await this.calculateExpectedDiffForToken(
        chainInfo,
        tokenInPortfolio,
        matchingPortfolioMovements,
        feeToken,
      );

      deviations.push(
        this.evaluateDeviationAgainstThreshold(
          tokenInPortfolio,
          expectedDiff,
          acceptedDeviations,
          matchingPortfolioMovements.length,
        ),
      );
    }

    return deviations;
  }
}
