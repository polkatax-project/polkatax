import { createDIContainer } from "../src/server/di-container";
import * as fs from "fs";
import { SubscanApi } from "../src/server/blockchain/substrate/api/subscan.api";
import { PortfolioMovement } from "../src/server/data-aggregation/model/portfolio-movement";
import { Token } from "../src/server/blockchain/substrate/model/token";
import { fetchPortfolioMovements } from "./helper/fetch-portfolio-movements";

const createDiffSheet = (
  balances: { block?: number; balance: number; diff?: number }[],
  portfolioMovements: PortfolioMovement[],
  tolerance = 0.01,
  tolerance_xcm = 0.05,
) => {
  for (let idx = 1; idx < balances.length; idx++) {
    balances[idx].diff = balances[idx].balance - balances[idx - 1].balance;
  }
  balances.shift(); // remove first element because it cannot have a 'diff'
  const diffSheet = balances.map((b) => {
    const block = b.block;
    const matchingMovements = portfolioMovements.filter(
      (p) =>
        p.block === block || Number(p.extrinsic_index.split("-")[0]) === block,
    );

    let expectedChange = 0;

    matchingMovements.forEach((p) => {
      expectedChange += -(p?.feeUsed ?? 0) - (p?.tip ?? 0);
      p.transfers.forEach((t) => {
        expectedChange += t?.amount ?? 0;
      });
    });

    const firstMatchingMovement =
      matchingMovements.length > 0 ? matchingMovements[0] : undefined;
    return {
      ...b,
      extrinsic_index: firstMatchingMovement?.extrinsic_index,
      expectedBalanceChange: expectedChange,
      deviationFromExpectation: b.diff - expectedChange,
      label: firstMatchingMovement?.label,
    };
  });

  const unexplainedChanges = diffSheet.filter(
    (s) =>
      diffSheet.indexOf(s) > 0 &&
      ((Math.abs(s.deviationFromExpectation) > tolerance &&
        s.label !== "xcm_transfer") ||
        Math.abs(s.deviationFromExpectation) > tolerance_xcm),
  );

  return { diffSheet, unexplainedChanges };
};

function fetchToken(domain: string): Promise<Token> {
  const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi");
  return subscanApi.fetchNativeToken(domain);
}

async function getAllBalanceChanges(wallet: string, domain: string) {
  const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi");
  let balanceChanges =
    (await subscanApi.fetchBalanceHistory(wallet, domain)) ?? [];
  return balanceChanges.sort((a, b) => a.block - b.block);
}

export const verifyNativeBalanceHistory = async (
  address: string,
  chain: { domain: string; label: string; token: string },
  minDate?: number,
) => {
  const token = await fetchToken(chain.domain);
  const balanceChanges = await getAllBalanceChanges(address, chain.domain);
  const { portfolioMovements } = await fetchPortfolioMovements(
    address,
    chain,
    minDate,
  );
  const minBlock = portfolioMovements.reduce(
    (curr, next) => Math.min(curr, next.block ?? Number.MAX_SAFE_INTEGER),
    Number.MAX_SAFE_INTEGER,
  );
  const balanceChangesFiltered = balanceChanges
    .filter((b) => b.block >= minBlock)
    .map((b) => {
      return {
        ...b,
        balance: Number(b.balance) / Math.pow(10, token.token_decimals),
      };
    });
  const { diffSheet, unexplainedChanges } = createDiffSheet(
    balanceChangesFiltered,
    portfolioMovements,
    0.01,
    0.05,
  );
  if (unexplainedChanges.length > 0) {
    console.log("NOK!");
    fs.writeFileSync(
      `./canary-tests/out/${address}-unexplainedChanges.json`,
      JSON.stringify(unexplainedChanges, null, 2),
    );
    fs.writeFileSync(
      `./canary-tests/out/${address}-diffSheet.json`,
      JSON.stringify(diffSheet, null, 2),
    );
    fs.writeFileSync(
      `./canary-tests/out/${address}-portfolioMovements.json`,
      JSON.stringify(portfolioMovements, null, 2),
    );
    console.log("Output fils were stored under /canary-tests/out/");
  }
  return unexplainedChanges;
};
