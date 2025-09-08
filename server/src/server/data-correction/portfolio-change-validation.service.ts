import { SubscanApi } from "../blockchain/substrate/api/subscan.api";
import { Block } from "../blockchain/substrate/model/block";
import {
  PortfolioMovement,
  TaxableEvent,
} from "../data-aggregation/model/portfolio-movement";
import {
  PortfolioDifference,
  PortfolioDifferenceService,
} from "./portfolio-difference.service";
import * as substrateNodesWsEndpoints from "../../../res/substrate-nodes-ws-endpoints.json";
import {
  DEFAULT_DEVIATION_LIMIT,
  DeviationLimit,
} from "./model/deviation-limit";
import { Deviation } from "./model/deviation";

export class PortfolioChangeValidationService {
  constructor(
    private portfolioDifferenceSerivce: PortfolioDifferenceService,
    private subscanApi: SubscanApi,
  ) {}

  private async fetchPortfolioDifferences(
    chainInfo: { domain: string; token: string },
    address: string,
    minBlockNum: number,
    maxBlockNum: number,
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
    acceptedDeviations: DeviationLimit[],
    minBlockNum: number,
    maxBlockNum: number,
    feeToken?: string,
  ): Promise<Deviation[]> {
    if (!Object.keys(substrateNodesWsEndpoints).includes(chainInfo.domain)) {
      return [];
    }

    const { portfolioDifferences, minBlock, maxBlock } =
      await this.fetchPortfolioDifferences(
        chainInfo,
        address,
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
    acceptedDeviations: DeviationLimit[],
    minBlockNum: number,
    maxBlockNum: number,
  ): Promise<string | undefined> {
    if (!Object.keys(substrateNodesWsEndpoints).includes(chainInfo.domain)) {
      return;
    }
    const { portfolioDifferences, minBlock, maxBlock } =
      await this.fetchPortfolioDifferences(
        chainInfo,
        address,
        minBlockNum,
        maxBlockNum,
      );

    if (portfolioDifferences.length === 0) {
      return;
    }

    let feeTokens = [chainInfo.token, undefined];
    portfolioDifferences.forEach((p) => feeTokens.push(p.unique_id));

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
  ): Promise<{ expectedDiff: number; transferCounter: number }> {
    let transferCounter = 0;
    let expectedDiff = 0;

    if (feeToken === tokenInPortfolio.unique_id) {
      const totalFees = matchingPortfolioMovements.reduce(
        (curr, p) =>
          curr +
          ((p as PortfolioMovement)?.feeUsed ?? 0) +
          ((p as PortfolioMovement)?.tip ?? 0), // - (p?.xcmFee ?? 0);
        0,
      );
      expectedDiff -= totalFees / 10 ** tokenInPortfolio.decimals;
    }

    matchingPortfolioMovements.forEach((p) => {
      p.transfers.forEach((t) => {
        if (t.asset_unique_id === tokenInPortfolio.unique_id) {
          transferCounter++;
          expectedDiff += t?.amount ?? 0;
        }
      });
    });

    return { expectedDiff, transferCounter };
  }

  private evaluateDeviationAgainstThreshold(
    tokenInPortfolio: PortfolioDifference,
    expectedDiff: number,
    acceptedDeviations: DeviationLimit[],
    numberTx: number,
  ): Deviation {
    const signedDeviation = tokenInPortfolio.diff - expectedDiff;
    const deviation = Math.abs(signedDeviation);

    const maxAllowedDeviation =
      acceptedDeviations.find(
        (a) => a.symbol.toUpperCase() === tokenInPortfolio.symbol.toUpperCase(),
      ) ?? DEFAULT_DEVIATION_LIMIT;

    return {
      balanceBefore: tokenInPortfolio.balanceBefore,
      balanceAfter: tokenInPortfolio.balanceAfter,
      symbol: tokenInPortfolio.symbol,
      unique_id: tokenInPortfolio.unique_id,
      asset_id: tokenInPortfolio.asset_id,
      diff: tokenInPortfolio.diff,
      decimals: tokenInPortfolio.decimals,
      deviation,
      signedDeviation,
      expectedDiff,
      absoluteDeviationTooLarge: Math.abs(deviation) > maxAllowedDeviation.max,
      singlePaymentDeviationTooLarge:
        Math.abs(deviation) > maxAllowedDeviation.singlePayment,
      numberTx,
      maxAllowedDeviation: maxAllowedDeviation.max,
      maxDeviationSinglePayment: maxAllowedDeviation.singlePayment,
    };
  }

  async calculateDeviation(
    chainInfo: { domain: string; token: string },
    portfolioMovements: TaxableEvent[],
    portfolioDifferences: PortfolioDifference[],
    acceptedDeviations: DeviationLimit[],
    minBlock: Block,
    maxBlock: Block,
    feeToken?: string,
  ): Promise<Deviation[]> {
    const deviations: Deviation[] = [];

    const matchingPortfolioMovements = this.filterMovementsWithinRange(
      portfolioMovements,
      minBlock,
      maxBlock,
    );

    // compute deviations per token
    for (const tokenInPortfolio of portfolioDifferences) {
      const { expectedDiff, transferCounter } =
        await this.calculateExpectedDiffForToken(
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
          transferCounter,
        ),
      );
    }

    return deviations;
  }

  disconnectApi() {
    this.portfolioDifferenceSerivce.disconnectApi();
  }
}
