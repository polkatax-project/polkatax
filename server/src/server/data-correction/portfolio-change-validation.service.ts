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
      portfolioMovements,
      portfolioDifferences,
      acceptedDeviations,
      minBlock,
      maxBlock,
    );
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
    tokenInPortfolio: PortfolioDifference,
    matchingPortfolioMovements: TaxableEvent[],
  ): Promise<{
    expectedDiff: number;
    transferCounter: number;
    fees: number;
    feesFiat: number;
  }> {
    let transferCounter = 0;
    let expectedDiff = 0;

    const fees = matchingPortfolioMovements
      .filter((p) => p.feeTokenUniqueId === tokenInPortfolio.unique_id)
      .reduce(
        (curr, p) =>
          curr +
          ((p as PortfolioMovement)?.feeUsed ?? 0) +
          ((p as PortfolioMovement)?.tip ?? 0),
        0,
      );
    expectedDiff -= fees;

    const feesFiat = matchingPortfolioMovements
      .filter((p) => p.feeTokenUniqueId === tokenInPortfolio.unique_id)
      .reduce(
        (curr, p) => curr + ((p as PortfolioMovement)?.feeUsedFiat ?? 0),
        0,
      );

    matchingPortfolioMovements.forEach((p) => {
      p.transfers.forEach((t) => {
        if (t.asset_unique_id === tokenInPortfolio.unique_id) {
          transferCounter++;
          expectedDiff += t?.amount ?? 0;
        }
      });
    });

    return { expectedDiff, transferCounter, fees, feesFiat };
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
    portfolioMovements: TaxableEvent[],
    portfolioDifferences: PortfolioDifference[],
    acceptedDeviations: DeviationLimit[],
    minBlock: Block,
    maxBlock: Block,
  ): Promise<Deviation[]> {
    const deviations: Deviation[] = [];

    const matchingPortfolioMovements = this.filterMovementsWithinRange(
      portfolioMovements,
      minBlock,
      maxBlock,
    );

    // compute deviations per token
    for (const tokenInPortfolio of portfolioDifferences) {
      const { expectedDiff, transferCounter, fees, feesFiat } =
        await this.calculateExpectedDiffForToken(
          tokenInPortfolio,
          matchingPortfolioMovements,
        );

      deviations.push({
        ...this.evaluateDeviationAgainstThreshold(
          tokenInPortfolio,
          expectedDiff,
          acceptedDeviations,
          transferCounter,
        ),
        fees,
        feesFiat,
      });
    }

    return deviations;
  }

  disconnectApi() {
    this.portfolioDifferenceSerivce.disconnectApi();
  }
}
