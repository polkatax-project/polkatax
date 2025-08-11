import { PortfolioMovement } from "../../src/server/data-aggregation/model/portfolio-movement";

export interface PortfolioVerificationResult {
  endBlock: number;
  startBlock: number;
  deviation: number;
  deviationAbs: number;
  deviationPerPayment: number;
  asset_unique_id: string;
  symbol: string;
}

export const analysePortfolioChanges = (
  feeToken: string,
  portfolios: {
    timestamp: number;
    blockNumber?: number;
    balances: { asset_unique_id: string; symbol: string; balance: number }[];
  }[],
  portfolioMovements: PortfolioMovement[],
): PortfolioVerificationResult[] => {
  if (portfolioMovements.length === 0) {
    return [];
  }

  const tokens: { asset_unique_id: string; symbol: string }[] = [];
  portfolios.forEach((p) =>
    p.balances.forEach((b) => {
      if (b.asset_unique_id) {
        if (!tokens.find((t) => t.asset_unique_id === b.asset_unique_id)) {
          tokens.push({ asset_unique_id: b.asset_unique_id, symbol: b.symbol });
        }
      }
    }),
  );

  const results: PortfolioVerificationResult[] = [];
  for (let token of tokens) {
    for (let idx = 1; idx < portfolios.length; idx++) {
      const intervalStart = portfolios[idx - 1].timestamp;
      const intervalEnd = portfolios[idx].timestamp;
      const balanceNow =
        portfolios[idx].balances.find(
          (b) => b.asset_unique_id === token.asset_unique_id,
        )?.balance ?? 0;
      const balanceBefore =
        portfolios[idx - 1].balances.find(
          (b) => b.asset_unique_id === token.asset_unique_id,
        )?.balance ?? 0;
      const actualBalanceChange = balanceNow - balanceBefore;
      const ignoreFees = token.asset_unique_id !== feeToken;
      const history = [];
      let expectedChange = 0;

      const matchingPortfolioMovements = portfolioMovements.filter(
        (p) => p.timestamp > intervalStart && p.timestamp <= intervalEnd,
      );

      matchingPortfolioMovements.forEach((p) => {
        if (!ignoreFees) {
          expectedChange += -(p?.feeUsed ?? 0) - (p?.tip ?? 0); // - (p?.xcmFee ?? 0);
        }
        p.transfers.forEach((t) => {
          if (
            t.asset_unique_id === token.asset_unique_id ||
            (!t.asset_unique_id &&
              t.symbol.toUpperCase() === token.symbol.toUpperCase() &&
              t.module === "xcm")
          ) {
            expectedChange += t?.amount ?? 0;
            history.push(p);
          }
        });
      });

      const expectedVsActual = actualBalanceChange - expectedChange;
      if (actualBalanceChange === 0 && expectedChange === 0) {
        continue;
      }
      const deviationPerPayment = Math.abs(
        history.length > 0
          ? expectedVsActual / history.length
          : expectedVsActual,
      );
      console.log(
        `${new Date(intervalStart).toISOString()} - ${new Date(intervalEnd).toISOString()}: Real balance change ${token.symbol}/${token.asset_unique_id}: ${actualBalanceChange}. Expected change: ${expectedChange}. Payments: ${history.length}. Deviation per payment: ${deviationPerPayment} ${token.symbol}`,
      );

      results.push({
        endBlock: portfolios[idx].blockNumber,
        startBlock: portfolios[idx - 1].blockNumber,
        deviation: expectedVsActual,
        deviationAbs: Math.abs(expectedVsActual),
        deviationPerPayment: deviationPerPayment,
        asset_unique_id: token.asset_unique_id,
        symbol: token.symbol,
      });
    }
  }
  return results;
};
