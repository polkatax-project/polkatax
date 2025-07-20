import * as fs from "fs";
import { Payment } from "../../src/server/data-aggregation/model/payment";
import { SubscanEvent } from "../../src/server/blockchain/substrate/model/subscan-event";

export const verifyPortfolioHistory = (
  wallet: string,
  chainName: string,
  feeToken: string,
  portfolios: {
    timestamp: number;
    blockNumber?: number;
    balances: { asset_unique_id: string; symbol: string; balance: number }[];
  }[],
  payments: Payment[],
  unmatchedEvents: SubscanEvent[],
  tolerance: number,
  saveDebugFiles = false,
) => {
  if (payments.length === 0) {
    console.log("User has not payments");
    return;
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

  console.log(
    `Found tokens ${tokens.map((t) => t.symbol).join(", ")} in portfolio`,
  );

  const intervalResults: {
    endBlock: number;
    startBlock: number;
    deviation: number;
    asset_unique_id: string;
    symbol: string;
  }[] = [];
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
      const sheet = [];
      const ignoreFees = token.asset_unique_id !== feeToken;
      const history = [];
      let expectedChange = 0;

      if (intervalStart === 1709458668000 && intervalEnd === 1709458704000) {
        console.log("TODO:!");
      }
      const matchingPayments = payments.filter(
        (p) => p.timestamp > intervalStart && p.timestamp <= intervalEnd,
      );

      matchingPayments.forEach((p) => {
        if (!ignoreFees) {
          expectedChange += -(p?.feeUsed ?? 0) - (p?.tip ?? 0); // - (p?.xcmFee ?? 0);
        }
        p.transfers.forEach((t) => {
          if (t.amount === -22208.985273074737) {
            console.log("TODO:!");
          }
          if (
            t.asset_unique_id === token.asset_unique_id ||
            (t.symbol.toUpperCase() === token.symbol.toUpperCase() &&
              t.module === "xcm")
          ) {
            expectedChange += t?.amount ?? 0;
            history.push(p);
          }
        });
        // console.log(p.extrinsic_index + " matched: " + matched +  " ts " + p.timestamp + " amount " + amount)
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
        `${new Date(intervalStart).toISOString()}: ${balanceBefore} ${token.symbol} - ${new Date(intervalEnd).toISOString()}: ${balanceNow} ${token.symbol}`,
      );
      console.log(
        `Actual balance change ${token.symbol}/${token.asset_unique_id}: ${actualBalanceChange}. Expected change: ${expectedChange}. Payments: ${history.length}`,
      );
      console.log(
        `Deviation per payment: ${deviationPerPayment} ${token.symbol}`,
      );

      if (deviationPerPayment > tolerance) {
        const firstMatchingPayment =
          matchingPayments.length > 0 ? matchingPayments[0] : undefined;
        console.error("Difference between actual and expected too large!");
        intervalResults.push({
          endBlock: portfolios[idx].blockNumber,
          startBlock: portfolios[idx - 1].blockNumber,
          deviation: Math.abs(expectedChange - actualBalanceChange),
          asset_unique_id: token.asset_unique_id,
          symbol: token.symbol,
        });
        sheet.push({
          endBlock: portfolios[idx].blockNumber,
          startBlock: portfolios[idx - 1].blockNumber,
          intervalStart,
          intervalEnd,
          expectedBalanceChange: expectedChange,
          label: firstMatchingPayment?.label,
          asset_unique_id: token.asset_unique_id,
          symbol: token.symbol,
          actualBalanceChange,
          history,
        });
        const events = unmatchedEvents.filter(
          (e) => e.timestamp > intervalStart && e.timestamp <= intervalEnd,
        );
        if (saveDebugFiles) {
          fs.writeFileSync(
            `./e2e-tests/out/${wallet.substring(0, 4)}_${chainName}_payment_${intervalEnd}.json`,
            JSON.stringify({ matchingPayments, events }, null, 2),
          );
          fs.writeFileSync(
            `./e2e-tests/out/${wallet.substring(0, 4)}_${chainName}_${token}_sheet_${intervalEnd}.json`,
            JSON.stringify(sheet, null, 2),
          );
        }
      } else {
        console.log("OK");
      }
    }
  }
  return intervalResults;
};
