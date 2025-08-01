import { createDIContainer } from "../src/server/di-container";
import { SubscanApi } from "../src/server/blockchain/substrate/api/subscan.api";
import {
  fetchPortfolioMovements,
  startStubs,
  stopStubs,
} from "./helper/fetch-portfolio-movements";
import { Wallet } from "./helper/wallet";
import * as fs from "fs";
import {
  analysePortfolioChanges,
  PortfolioVerificationResult,
} from "./helper/analyze-portfolio-changes";

const checkPoolTokens = () => {
  const { portfolioMovements } = JSON.parse(
    fs.readFileSync(
      `./canary-tests/out-temp/portfolio-movements.json`,
      "utf-8",
    ),
  );
  let pool2Change = 0;
  let pool4Change = 0;
  portfolioMovements.forEach((p) => {
    p.transfers
      .filter(
        (t) =>
          t.symbol.toLowerCase() === "2-pool" ||
          t.symbol.toLowerCase() === "4-pool",
      )
      .forEach((t) => {
        if (t.symbol.toLowerCase() === "2-pool") {
          pool2Change += t.amount;
        } else {
          pool4Change += t.amount;
        }
      });
  });
  return { pool2Change, pool4Change };
};

export const fetchPortfolioChangesExpectedVSActual = async (
  address: string,
  chain: { domain: string; label: string; token: string },
  minDate?: number,
  useFees = false,
) => {
  switch (chain.domain) {
    case "hydration":
    case "bifrost":
      return await fetchTokenChangesExpectedVSActual(
        address,
        chain,
        useFees,
        minDate,
      );
    default:
      return fetchAssetChangesExpectedVSActual(address, chain, minDate);
  }
};

export const fetchTokenChangesExpectedVSActual = async (
  address: string,
  chain: { domain: string; label: string; token: string },
  useFees = true,
  minDate?: number,
): Promise<{
  results: PortfolioVerificationResult[];
  pool2Change: number;
  pool4Change: number;
}> => {
  const { portfolioMovements, minBlock, maxBlock, unmatchedEvents } =
    await fetchPortfolioMovements(address, chain, minDate);
  fs.writeFileSync(
    `./canary-tests/out-temp/portfolio-movements.json`,
    JSON.stringify(
      { portfolioMovements, unmatchedEvents, minBlock, maxBlock },
      null,
      2,
    ),
  );

  const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi");
  const timestamps = [];
  const blocksToFetch = [];
  const chunks = 1;
  for (
    let blockNum = minBlock;
    blockNum <= maxBlock;
    blockNum += Math.ceil((maxBlock - minBlock) / chunks)
  ) {
    const block = await subscanApi.fetchBlock(chain.domain, blockNum);
    timestamps.push(block.timestamp);
    blocksToFetch.push(blockNum);
  }
  const portfolios = await new Wallet().fetchTokenBalances(
    chain.domain,
    chain.token,
    address,
    blocksToFetch,
  );
  const results = analysePortfolioChanges(
    useFees ? chain.token : undefined,
    portfolios.map((p) => ({
      timestamp: timestamps[portfolios.indexOf(p)],
      balances: p.values,
      blockNumber: blocksToFetch[portfolios.indexOf(p)],
    })),
    portfolioMovements,
  );
  if (chain.domain === "hydration") {
    checkPoolTokens();
  }
  const hydrationPoolTokenChanges =
    chain.domain === "hydration"
      ? checkPoolTokens()
      : { pool2Change: 0, pool4Change: 0 };
  return { ...hydrationPoolTokenChanges, results };
};

export const fetchAssetChangesExpectedVSActual = async (
  address: string,
  chain: { domain: string; label: string; token: string },
  minDate?: number,
): Promise<{ results: PortfolioVerificationResult[] }> => {
  const { portfolioMovements, minBlock, maxBlock, unmatchedEvents } =
    await fetchPortfolioMovements(address, chain, minDate);
  fs.writeFileSync(
    `./canary-tests/out-temp/portfolio-movements.json`,
    JSON.stringify(
      { portfolioMovements, unmatchedEvents, minBlock, maxBlock },
      null,
      2,
    ),
  );

  const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi");
  const portfolioNow = await subscanApi.fetchAccountTokens(
    chain.domain,
    address,
  );
  const mergedPortfolio = [
    ...(portfolioNow.builtin ?? []),
    ...(portfolioNow.native ?? []),
    ...(portfolioNow.assets ?? []),
  ];
  const relevantTokens = mergedPortfolio
    .filter(
      (b) =>
        b.unique_id.startsWith("standard_assets/") || b.symbol === chain.token,
    )
    .map((b) => ({
      asset_unique_id: b.unique_id,
      symbol: b.symbol,
      decimals: b.decimals,
      asset_id: Number(b.asset_id),
    }));

  const portfolios: {
    timestamp: number;
    blockNumber?: number;
    balances: { asset_unique_id: string; symbol: string; balance: number }[];
  }[] = [];
  const numberChunks = 1;
  for (
    let blockNumber = minBlock;
    blockNumber <= maxBlock;
    blockNumber += Math.ceil((maxBlock - minBlock) / numberChunks)
  ) {
    const block = await subscanApi.fetchBlock(chain.domain, blockNumber);
    const portfolio = await new Wallet().getAssetBalances(
      chain.domain,
      chain.token,
      address,
      blockNumber,
      relevantTokens,
    );
    portfolios.push({
      timestamp: block.timestamp,
      balances: portfolio.values,
      blockNumber,
    });
  }

  const portfolioChanges = analysePortfolioChanges(
    chain.token,
    portfolios,
    portfolioMovements,
  );
  return { results: portfolioChanges };
  /*const results = []
  for (let token of relevantTokens) {
    const portfolioList = [
      ...portfolios.map((p) => ({
        blockNumber: p.blockNumber,
        timestamp: p.timestamp,
        balances: p.balances.filter(
          (v) => v.asset_unique_id === token.asset_unique_id,
        ),
      })),
    ];
    
    portfolios.map((p) => ({
      timestamp: timestamps[portfolios.indexOf(p)],
      balances: p.values,
      blockNumber: blocksToFetch[portfolios.indexOf(p)],
    })),

    results.push({ asset_unique_id: token.asset_unique_id, symbol: token.symbol, result: analysePortfolioChanges(
      chain.token,
      portfolioList,
      portfolioMovements
    )});
  }
  return results*/
};
