import { createDIContainer } from "../src/server/di-container";
import { SubscanApi } from "../src/server/blockchain/substrate/api/subscan.api";
import { fetchPayments } from "./fetch-payments";
import { Wallet } from "./wallet";
import * as fs from "fs";
import { verifyPortfolioHistory } from "./helper/verify-portfolio-history";
import { SubscanEvent } from "../src/server/blockchain/substrate/model/subscan-event";
import { SubscanService } from "../src/server/blockchain/substrate/api/subscan.service";
import { SpecialEventsToTransfersService } from "../src/server/data-aggregation/services/special-events-to-transfers.service";
import { Payment } from "../src/server/data-aggregation/model/payment";


const checkPoolTokens = async () => {
  const { payments, unmatchedEvents, minBlock, maxBlock } = JSON.parse(
    fs.readFileSync(`./e2e-tests/out/all.json`, "utf-8"),
  );
  let pool2 = 0
  let pool4 = 0
  payments.forEach(p => {
    p.transfers.filter(t => t.symbol.toLowerCase() === '2-pool' || t.symbol.toLowerCase() === '4-pool').forEach(t => {
      if (t.symbol.toLowerCase() === '2-pool') {
        pool2 += t.amount
      } else {
        pool4 += t.amount
      }
    })
  })
  console.log("2-Pool change " + pool2)
  console.log("4-Pool change " + pool4)
}

const verifyPortfolioChange = async (
  address: string,
  chain: { domain: string; label: string; token: string },
  tolerance = 0.5,
  useFees = true,
) => {
  const { payments, minBlock, maxBlock, unmatchedEvents } = await fetchPayments(
    address,
    chain,
  );
  fs.writeFileSync(
    `./e2e-tests/out/all.json`,
    JSON.stringify({ payments, unmatchedEvents, minBlock, maxBlock }, null, 2),
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
  const portfolios = await new Wallet().fetchPortfolios(
    chain.domain,
    chain.token,
    address,
    blocksToFetch,
  );
  // console.log(JSON.stringify(portfolios, null, 4))
  verifyPortfolioHistory(
    address,
    chain.domain,
    useFees ? chain.token : undefined,
    portfolios.map((p) => ({
      timestamp: timestamps[portfolios.indexOf(p)],
      balances: p.values,
      blockNumber: blocksToFetch[portfolios.indexOf(p)],
    })),
    payments,
    unmatchedEvents,
    tolerance,
  );
  if (chain.domain === 'hydration') {
    checkPoolTokens()
  }
};

const verifyAssetHubPortfolioChange = async (
  address: string,
  chain: { domain: string; label: string; token: string },
) => {
  const { payments, minBlock, maxBlock, unmatchedEvents } = await fetchPayments(
    address,
    chain,
  );
  fs.writeFileSync(
    `./e2e-tests/out/all.json`,
    JSON.stringify({ payments, unmatchedEvents, minBlock, maxBlock }, null, 2),
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
    verifyPortfolioHistory(
      address,
      chain.domain,
      chain.token,
      portfolioList,
      payments,
      unmatchedEvents,
      token.symbol === chain.token ? 0.5 : 0.05,
    );
  }
};

const assetHubZoomInError = async (
  address: string,
  chain: { domain: string; label: string; token: string },
  tokenOfInterest: string,
  interval?: { startBlock: number; endBlock: number },
  cachedData?: any,
  tolerance?: number,
) => {
  const { payments, minBlock, maxBlock, unmatchedEvents } =
    cachedData?.payments ?? (await fetchPayments(address, chain));
  const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi");
  const accountTokens =
    cachedData?.accountTokens ??
    (await subscanApi.fetchAccountTokens(chain.domain, address));
  const mergedPortfolio = [
    ...(accountTokens.builtin ?? []),
    ...(accountTokens.native ?? []),
    ...(accountTokens.assets ?? []),
  ];
  const relevantToken = mergedPortfolio
    .filter((b) => b.symbol === tokenOfInterest)
    .map((b) => ({
      asset_unique_id: b.unique_id,
      symbol: b.symbol,
      decimals: b.decimals,
      asset_id: Number(b.asset_id),
    }))[0];

  const blocks = interval
    ? [interval.startBlock, interval.endBlock]
    : [minBlock, maxBlock];
  const portfolios: {
    timestamp: number;
    blockNumber?: number;
    balances: { asset_unique_id: string; symbol: string; balance: number }[];
  }[] = [];

  const timestamps = [];
  const blocksToFetch = [
    blocks[0],
    Math.floor((blocks[1] - blocks[0]) / 2) + blocks[0],
    blocks[1],
  ];

  for (let blockNumber of blocksToFetch) {
    const block = await subscanApi.fetchBlock(chain.domain, blockNumber);
    timestamps.push(block.timestamp);
    const cachedPortfolio = cachedData?.portfolios?.find(
      (p) => p.blockNumber === blockNumber,
    );
    const balances =
      cachedPortfolio?.balances ??
      (
        await new Wallet().getAssetBalances(
          chain.domain,
          chain.token,
          address,
          blockNumber,
          [relevantToken],
        )
      ).values;
    portfolios.push({
      timestamp: block.timestamp,
      balances,
      blockNumber,
    });
  }
  const portfolioList = [
    ...portfolios.map((p) => ({
      blockNumber: p.blockNumber,
      timestamp: p.timestamp,
      balances: p.balances.filter(
        (v) => v.asset_unique_id === relevantToken.asset_unique_id,
      ),
    })),
  ];
  const badIntervals = verifyPortfolioHistory(
    address,
    chain.domain,
    chain.token,
    portfolioList,
    payments,
    unmatchedEvents,
    tolerance ?? 0.1,
  );
  if (badIntervals.length === 0) {
    console.log("No issues found.");
    return;
  }
  const max = Math.max(...badIntervals.map((i) => i.deviation));
  const intervalOfChoice = badIntervals.find((i) => i.deviation === max);
  if (intervalOfChoice.endBlock - intervalOfChoice.startBlock > 1) {
    assetHubZoomInError(
      address,
      chain,
      tokenOfInterest,
      intervalOfChoice,
      {
        portfolios,
        payments: { payments, minBlock, maxBlock, unmatchedEvents },
        accountTokens,
      },
      tolerance,
    );
  } else {
    const block1  = await subscanApi.fetchBlock(
      chain.domain,
      interval.startBlock,
    );
    const block2 = await subscanApi.fetchBlock(chain.domain, interval.endBlock);
    console.log("from " + block1.timestamp + " to " + block2.timestamp)
    console.log("Finished : " + JSON.stringify(intervalOfChoice));
  }
};

const portfolioZoomInError = async (
  address: string,
  chain: { domain: string; label: string; token: string },
  tokenUniqueId: string,
  tokenSymbol: string,
  tolerance = 0.01,
  withFees = true,
  interval?: { startBlock: number; endBlock: number },
  cachedData?: any,
) => {
  const { payments, minBlock, maxBlock, unmatchedEvents } =
    cachedData?.payments ?? (await fetchPayments(address, chain));
  const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi");

  const blocks = interval
    ? [interval.startBlock, interval.endBlock]
    : [minBlock, maxBlock];
  const timestamps = [];
  const blocksToFetch = [
    blocks[0],
    Math.floor((blocks[1] - blocks[0]) / 2) + blocks[0],
    blocks[1],
  ];
  for (const blockNum of blocksToFetch) {
    const block = await subscanApi.fetchBlock(chain.domain, blockNum);
    timestamps.push(block.timestamp);
  }
  const portfolios = await new Wallet().fetchPortfolios(
    chain.domain,
    chain.token,
    address,
    blocksToFetch,
  );
  const badIntervals = verifyPortfolioHistory(
    address,
    chain.domain,
    withFees ? chain.token : "",
    portfolios.map((p) => ({
      timestamp: timestamps[portfolios.indexOf(p)],
      balances: [
        p.values.find((b) => b.asset_unique_id === tokenUniqueId) ?? {
          asset_unique_id: tokenUniqueId,
          symbol: tokenSymbol,
          balance: 0,
        },
      ],
      blockNumber: blocksToFetch[portfolios.indexOf(p)],
    })),
    payments,
    unmatchedEvents,
    tolerance,
  );
  if (badIntervals.length === 0) {
    console.log("No issues found.");
    return;
  }
  const max = Math.max(...badIntervals.map((i) => i.deviation));
  const intervalOfChoice = badIntervals.find((i) => i.deviation === max);
  if (intervalOfChoice.endBlock - intervalOfChoice.startBlock > 1) {
    portfolioZoomInError(
      address,
      chain,
      tokenUniqueId,
      tokenSymbol,
      tolerance,
      withFees,
      intervalOfChoice,
      { payments: { payments, minBlock, maxBlock, unmatchedEvents } },
    );
  } else {
    const block1 = await subscanApi.fetchBlock(
      chain.domain,
      interval.startBlock,
    );
    const block2 = await subscanApi.fetchBlock(chain.domain, interval.endBlock);
    const matchingPayments = payments.filter(
      (p) => p.timestamp > block1.timestamp && p.timestamp <= block2.timestamp,
    );
    const startPortfolio = portfolios.find((p) => p.block === block1.block_num);
    const endPortfolio = portfolios.find((p) => p.block === block2.block_num);
    console.log("=======");
    console.log(
      "Block " +
        block1.block_num +
        "/" +
        block1.timestamp +
        " : " +
        JSON.stringify(startPortfolio),
    );
    console.log("=======");
    console.log(
      "Block " +
        block2.block_num +
        "/" +
        block2.timestamp +
        " : " +
        JSON.stringify(endPortfolio),
    );
    console.log("=======");
    //fs.writeFileSync(`./e2e-tests/out/payments.json`, JSON.stringify({ payments, unmatchedEvents }, null, 2))
    //fs.writeFileSync(`./e2e-tests/out/matchingPayments.json`, JSON.stringify(matchingPayments, null, 2))
    console.log("finished : " + JSON.stringify(intervalOfChoice));
  }
};

const zoomIntoError = async (
  address: string,
  chainInfo: any,
  tokenUniqueId: string,
  tokenSymbol: string,
  tolerance = 0.5,
) => {
  const { payments, unmatchedEvents, minBlock, maxBlock } = JSON.parse(
    fs.readFileSync(`./e2e-tests/out/all.json`, "utf-8"),
  );
  portfolioZoomInError(
    address,
    chainInfo,
    tokenUniqueId,
    tokenSymbol,
    tolerance,
    true,
    undefined,
    { payments: { payments, unmatchedEvents, minBlock, maxBlock } },
  );
};
// zoomIntoError("16MRsnWMXvBiHK8FUu9GMNBaVFbY9RpVcCWbviRjL1ogGWQ7", { domain: 'hydration', label: '', token: 'HDX' }, 'asset_registry/28a5c2818590ee3c4d5d93a448190f3397144303', 'DOT', 0)

const ahZoomIntoError = async (
  address: string,
  chainInfo: any,
  token: string,
  tolerance = 0.1,
) => {
  const { payments, unmatchedEvents, minBlock, maxBlock } = JSON.parse(
    fs.readFileSync(`./e2e-tests/out/all.json`, "utf-8"),
  );
  assetHubZoomInError(
    address,
    chainInfo,
    token,
    undefined,
    { payments: { payments, unmatchedEvents, minBlock, maxBlock } },
    tolerance,
  );
};
// ahZoomIntoError("15rSJtfCbB3MtWmW5pNnRhNeJENSQX9hLXUikkAee6mJVC9j", { domain: 'assethub-polkadot', label: '', token: 'DOT' }, "USDC", 0.01);

const fetchTransfers = async () => {
  const subscanService: SubscanService = createDIContainer().resolve("subscanService");
  const result = await subscanService.fetchAllTransfers({
        chainName: "hydration",
        address: "13b6hRRYPHTxFzs9prvL2YGHQepvd4YhdDb9Tc7khySp3hMN",
        minDate: new Date(Date.UTC(2025, 6, 15)).getTime(), // new Date(Date.UTC(new Date().getFullYear() - 1, 0, 1)).getTime(), // 
      })
    fs.writeFileSync(`./e2e-tests/out/transfers.json`, JSON.stringify(result))
}
// fetchTransfers()

// ASSET HUB 
/**
 * Incoming cross-chain transfers are ignored. Instead listen to deposit events assetsIssued/balancesMinted
 */
// verifyAssetHubPortfolioChange("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
/**
 * Burn event ignored because burn is also called thrown during by xcm. Difference 6 DOT
 */
// verifyAssetHubPortfolioChange("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
/**
 * XCM: Works but MYTH xcm transfers which are not recognized. Formatting of multi location does not match. Reason unclear.
 * https://polkadot.subscan.io/xcm_message/polkadot-bff42d3f55c8f50357f1cbb3448387a3101657ea
 */
// verifyAssetHubPortfolioChange("1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
// verifyAssetHubPortfolioChange("13qSxtKtr54qebSQzf1c7MC9CwkkZMMFaXyHKq8LzjSjiU3M", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
// verifyAssetHubPortfolioChange("13vg3Mrxm3GL9eXxLsGgLYRueiwFCiMbkdHBL4ZN5aob5D4N", { domain: 'assethub-polkadot', label: '', token: 'DOT' }) // ~very slow

// coretime
//verifyAssetHubPortfolioChange("15fTH34bbKGMUjF1bLmTqxPYgpg481imThwhWcQfCyktyBzL", { domain: 'coretime-polkadot', label: '', token: 'DOT' }) 
// verifyAssetHubPortfolioChange("16aXFECXjLKBbEAjGtF6cs9besGQ8Yk8o4RzvA5FRPJNHeHN", { domain: 'coretime-polkadot', label: '', token: 'DOT' }) 
// verifyAssetHubPortfolioChange("15mYsj6DpBno58jRoV5HCTiVPFBuWhDLdsWtq3LxwZrfaTEZ", { domain: 'coretime-polkadot', label: '', token: 'DOT' }) 
// verifyAssetHubPortfolioChange("15tkmix9R7ZRYGsLGV15mpZSbicPjmnhLdnUccAwfRi7RPVV", { domain: 'coretime-polkadot', label: '', token: 'DOT' }) 
// verifyAssetHubPortfolioChange("16aXFECXjLKBbEAjGtF6cs9besGQ8Yk8o4RzvA5FRPJNHeHN", { domain: 'coretime-polkadot', label: '', token: 'DOT' }) 
// verifyAssetHubPortfolioChange("1HwQbUpcr99UA6W7WBK86RtMHJTBWRazpxuYfRHyhSCbE1j", { domain: 'coretime-polkadot', label: '', token: 'DOT' }) 

// people
// verifyAssetHubPortfolioChange("16LviqDmEdn49UqeVSw3N1SjoJxRVV1EBbydbEqqaCvdtAsY", { domain: 'people-polkadot', label: '', token: 'DOT' }) 
// verifyAssetHubPortfolioChange("142nFphK2qW4AWxZYFZiKjirKBMZPFRsCYDe75Rv9YSCkDUW", { domain: 'people-polkadot', label: '', token: 'DOT' }) 
// verifyAssetHubPortfolioChange("14Gnp9cpb4mrXrpbCVNQSEPyL3QhoccGB9qpTRxqKWWMWSxn", { domain: 'people-polkadot', label: '', token: 'DOT' }) 
// verifyAssetHubPortfolioChange("15mYsj6DpBno58jRoV5HCTiVPFBuWhDLdsWtq3LxwZrfaTEZ", { domain: 'people-polkadot', label: '', token: 'DOT' }) 
// verifyAssetHubPortfolioChange("12ryo7Fp21tKkFQWJ2vSVMY2BH3t9syk65FUaywraHLs3T4T", { domain: 'people-polkadot', label: '', token: 'DOT' }) 

// collectives
// verifyAssetHubPortfolioChange("1L66uQMKFnXKSZx9pCD5o56GvvP1i2Qns7CaS2AaKp9mnwc", { domain: 'collectives-polkadot', label: '', token: 'DOT' }) 
// verifyAssetHubPortfolioChange("168BAPzMCWtzvbUVAXjDcJjZCtog7tmoMN2kRa7nusoxJeB8", { domain: 'collectives-polkadot', label: '', token: 'DOT' }) 
// verifyAssetHubPortfolioChange("12zsKEDVcHpKEWb99iFt3xrTCQQXZMu477nJQsTBBrof5k2h", { domain: 'collectives-polkadot', label: '', token: 'DOT' }) 
// verifyAssetHubPortfolioChange("14EQvBy9h8xGbh2R3ustnkfkF514E7wpmHtg27gDaTLM2str", { domain: 'collectives-polkadot', label: '', token: 'DOT' }) 
// verifyAssetHubPortfolioChange("13C7Ssy9QNJk515SFezaKMfhMRFrRcZWBhXA3oDq1AuKVds5", { domain: 'collectives-polkadot', label: '', token: 'DOT' }) 


// ACALA
// verifyPortfolioChange("1UA2r4UWyAJfWyCEb39oevsUxuzB8XeriJSsdzVtoLNzddr", { domain: 'acala', label: '', token: 'ACA' })
/**
 * reward is also a transfer:
 * https://acala.subscan.io/account/13EXo5nS5kJMRHqghAcq1z3j3XpguLiWzvV8cbYSXXJsTBYy?tab=reward
 * https://acala.subscan.io/event?block=8089502
 */
// verifyPortfolioChange("13EXo5nS5kJMRHqghAcq1z3j3XpguLiWzvV8cbYSXXJsTBYy", { domain: 'acala', label: '', token: 'ACA' })
// verifyPortfolioChange("1sdEj2dBvsGUQ2MqiZWJ8hHss7cCZ4nFcrjE6xDBCtPYiJx", { domain: 'acala', label: '', token: 'ACA' })
// verifyPortfolioChange("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", { domain: 'acala', label: '', token: 'ACA' })
// verifyPortfolioChange("1sdEj2dBvsGUQ2MqiZWJ8hHss7cCZ4nFcrjE6xDBCtPYiJx", { domain: 'acala', label: '', token: 'ACA' })


// ASTAR
// verifyAssetHubPortfolioChange("13hDgWbatzrMmdPGz4F3Y63vP3qmdac7PUrujcN5a8nB6CkJ", { domain: 'astar', label: '', token: 'ASTR' })
// verifyAssetHubPortfolioChange("15tH5VV82YwsJPBGcBFmGvgkiBCkAzcCXbZLbZ7TkCJM6kdq", { domain: 'astar', label: '', token: 'ASTR' })
// verifyAssetHubPortfolioChange("16m3U19QHy39x5BBTR2FN9yh2k9LhUnS727N3wSH48P9wj8K", { domain: 'astar', label: '', token: 'ASTR' }) // slow
// verifyAssetHubPortfolioChange("153G4p8oHhKuVodS4pcQEgs23TrC9jfVueZ7npbL65JoFRYs", { domain: 'astar', label: '', token: 'ASTR' })
// verifyAssetHubPortfolioChange("15yZzmbMsogqqxVNNfe6t4LaYmjGWbPFDbADo23voJSKvywq", { domain: 'astar', label: '', token: 'ASTR' })
// verifyAssetHubPortfolioChange("13AxCbvHff9d9LBtdNZBT5f2JoiHVRaHyiuUwZMmnBuGrSE8", { domain: 'astar', label: '', token: 'ASTR' })


// MYTHOS
// verifyAssetHubPortfolioChange("0xf8683ecADdCb12891867CCDF4dbC96f47d62d67B", { domain: 'mythos', label: '', token: 'MYTH' })
// verifyAssetHubPortfolioChange("0x56F17ebFe6B126E9f196e7a87f74e9f026a27A1F", { domain: 'mythos', label: '', token: 'MYTH' })
// verifyAssetHubPortfolioChange("0xfd56a122ec50912811ec2856e6df5fd0a1581df2", { domain: 'mythos', label: '', token: 'MYTH' })
// verifyAssetHubPortfolioChange("0x5EE06FECF52b12c66b03700821FbBc9dD5680361", { domain: 'mythos', label: '', token: 'MYTH' })
// verifyAssetHubPortfolioChange("0xF6eAAdC72D1a58F735965EA196E4FA7029fC76dC", { domain: 'mythos', label: '', token: 'MYTH' })
// verifyAssetHubPortfolioChange("0x3359314e9dC3FE983a9f71AF25680fd6fe0CccC6", { domain: 'mythos', label: '', token: 'MYTH' }) // lot's of data.
// verifyAssetHubPortfolioChange("0xEcdbC924dFe6C6c7b2242890d0b4764dddBE40B1", { domain: 'mythos', label: '', token: 'MYTH' }) // lot's of data.
// verifyAssetHubPortfolioChange("0x7AdbF4458aaDa94129a898a142c4cda58BaEE04c", { domain: 'mythos', label: '', token: 'MYTH' }) // lot's of data.


// energywebx
// verifyAssetHubPortfolioChange("13KemmTsLpdz8sbdB8cL4Lw3PDVgy2UjEnayx72QgUbAcSRT", { domain: 'energywebx', label: '', token: 'EWT' })
// verifyAssetHubPortfolioChange("16dCndCe1hUGuqFNiBQdvmXtWTRN6MSf9s5wjiEkxTsBo5Jb", { domain: 'energywebx', label: '', token: 'EWT' })
// verifyAssetHubPortfolioChange("13VMMtNPxsTiJZ6rz5N9FJASnNg5iuEamf5SBBhiDTQJBKhk", { domain: 'energywebx', label: '', token: 'EWT' }) // lot's of data.
// verifyAssetHubPortfolioChange("1gQCP9rT9dfQKCnneh5w8mqxCH5E9XWXnt17wJqGLyZ7eEL", { domain: 'energywebx', label: '', token: 'EWT' }) // lot's of data.


// neuroweb
// verifyAssetHubPortfolioChange("16MRsnWMXvBiHK8FUu9GMNBaVFbY9RpVcCWbviRjL1ogGWQ7", { domain: 'neuroweb', label: '', token: 'NEURO' })
// verifyAssetHubPortfolioChange("15gPguU3rf2CdWwqahgc3HYk6R9bw5HSdDqYxoNyG9Enrc5V", { domain: 'neuroweb', label: '', token: 'NEURO' })
// verifyAssetHubPortfolioChange("12pGnMsHHe4cUVTnBpXEhxyfL59zcDSEk4xLA9EgYFUgS6Uq", { domain: 'neuroweb', label: '', token: 'NEURO' })
// verifyAssetHubPortfolioChange("14BSK3tU1iqT7U2UfdZGsQ7duLRUBXK6W4sUTUd5J7DQPoNz", { domain: 'neuroweb', label: '', token: 'NEURO' })

/////////////// everything ok until here


// Hydration
// KK verifyPortfolioChange("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", { domain: 'hydration', label: '', token: 'HDX' })
// KK verifyPortfolioChange("16882iTH5FHdH2ka552Rr6yUGUSvKPvQHBWAYLXjiCihVpgf", { domain: 'hydration', label: '', token: 'HDX' })
// KK verifyPortfolioChange("1po4rmTmihcdumpP7XP4ZnexNvaRX1bHoNawndvMk4udC1G", { domain: 'hydration', label: '', token: 'HDX' })
// KK verifyPortfolioChange("16CzpgW3YoR8FQYLromGxfVhare7JyLBsnUcm5i8GZocfujb", { domain: 'hydration', label: '', token: 'HDX' })
// verifyPortfolioChange("12R6XdCSw3HX59CX2kmCYzAkVrf5u4AZd7YExSjwMLNzm2da", { domain: 'hydration', label: '', token: 'HDX' }, 0.3, true)
// KK verifyPortfolioChange("12ZuLmUFrpmWW9CHTED925mnuZnK5JyZPqnsooq9pjuWBSYX", { domain: 'hydration', label: '', token: 'HDX' }) 
// OK verifyPortfolioChange("133cogzsFo7jnwp7jENBnygfj5GxnQi4hSZdNQtzuteULt4S", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyPortfolioChange("14XhPq7NHe6vGGxuQ21hcosA2XwTNtA9mWr5n5FNXkQZDS7U", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyPortfolioChange("13sJGSFAPsKbXrkXuZe4KU6Vb611NXtRjRwnp4e8bQNELhYV", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyPortfolioChange("1Zn6CU4CCHLDtrgxGsKYt65Ujd1vc72ydAxL5cUpymGHZoF", { domain: 'hydration', label: '', token: 'HDX' });
// OK verifyPortfolioChange("13BnzcNSL59RgCTXy4NZug78WXa4Yp6S2AxfAx34qsWEMvDR", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyPortfolioChange("1244idMo96seN3NTMVFpnfsXXHqx4zrztysAfww7UMMgaj2v", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyPortfolioChange("13jFF8C4JzKQt42qiPyTaBAVF5QdwnzFw6d8t7WUxdKSB4Yo", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyPortfolioChange("1xueyfG9g4is3jVsnkH73x31vWpKHHRowtKvyqb2scQkdC3", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyPortfolioChange("14QLEDMkLp7wt6ZfyvZA5mq59xHzMUTQrXSikFM2RZ78Cf3K", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyPortfolioChange("12YGU15jahiyNje51yP2JA7x6fWv4S1Kr3DgpjBPH2GN184r", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyPortfolioChange("13VyzGJCffWkeyrtaEtJtW6ySXACb34onwVJL7cYiTHWGEJK", { domain: 'hydration', label: '', token: 'HDX' }) 

/**
 * XCM: outgoing of 484.637955 USDC never lead to withdrawal of USDC...
 * https://polkadot.subscan.io/xcm_message/polkadot-8f3a407ccc0a5d3e5c4e24b71da81c8e6ed9da55
 */
// verifyPortfolioChange("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", { domain: 'hydration', label: '', token: 'HDX' })
/**
 * XCM: USDC mixup between USDC Wormhole and USDC native.
 * 40k HDX out of nowhere
 */
// verifyPortfolioChange("1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", { domain: 'hydration', label: '', token: 'HDX' })
// verifyPortfolioChange("131d4YS25qpuXiHrfJibuFYXwZrzwxpvU1ahvr3TJFNYcmfk", { domain: 'hydration', label: '', token: 'HDX' }) // jakub
verifyPortfolioChange("13b6hRRYPHTxFzs9prvL2YGHQepvd4YhdDb9Tc7khySp3hMN", { domain: 'hydration', label: '', token: 'HDX' }) 
/**
 * ok except DOT/asset_registry/28a5c2818590ee3c4d5d93a448190f3397144303 
 * XCM from nowhere (no sender address)
 * https://hydration.subscan.io/xcm_message/polkadot-bb0409f78a40c96fd8f0d1a7938d5b5cbba74fe5
 */
// verifyPortfolioChange("15rSJtfCbB3MtWmW5pNnRhNeJENSQX9hLXUikkAee6mJVC9j", { domain: 'hydration', label: '', token: 'HDX' })

/**
 * XCM without sender but the event is not indexed...https://hydration.subscan.io/extrinsic/7347162-3?tab=xcm_transfer
 */
//verifyPortfolioChange("16MRsnWMXvBiHK8FUu9GMNBaVFbY9RpVcCWbviRjL1ogGWQ7", { domain: 'hydration', label: '', token: 'HDX' })
// verifyPortfolioChange("12ZuLmUSUP6gHGboHBoBGPwC8KtxLLwizLhWSdJMbPuzvMhv", { domain: 'hydration', label: '', token: 'HDX' }) 


// Bifrost
/**
 * vtoken Minted event 3917920-5 cannot be found via subscan.
 * also crossinout events are missing. there's no clear mapping from multi location to token, e.g. : 6672187-6
 */
// verifyPortfolioChange("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", { domain: 'bifrost', label: '', token: 'BNC' })
/**
 * some events not showing up e.g. 4193678-18 (vGLMR Minted),
 * also vsDOT
 */
// verifyPortfolioChange("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", { domain: 'bifrost', label: '', token: 'BNC' })
// OK, large diff due to tx fees(?) BNC verifyPortfolioChange("1RRBm6aEAxYXjjacerrEyNxvhDZLbr9PJRvtbxD3NkgTB8S", { domain: 'bifrost', label: '', token: 'BNC' })
/**
 * Deposit event unclear provenance: https://bifrost.subscan.io/block/8207115?tab=event
 * Also missing vtoken minting event.
 */
// NOK: BNC, vBNC verifyPortfolioChange("15b7Ko56RgVBVWB9UXEnW4LhS2AAALRmcVpgx26Wr5yzVbeS", { domain: 'bifrost', label: '', token: 'BNC' })
// OK! verifyPortfolioChange("12TiTLQYFBsb2EUdaxFdcvo78gpkhajnuv7Jm8Aoy7c4z1YV", { domain: 'bifrost', label: '', token: 'BNC' })




// phala
// verifyAssetHubPortfolioChange("1eo82wr76n25UXYHNa9hym1ZTHeK4oBrNMcz97m71H85qfP", { domain: 'phala', label: '', token: 'PHA' }) 
// verifyAssetHubPortfolioChange("14EAEgGrbX3KCgyjBZRyB5qgYpuFHLB5AC8TX7hYLPRT1YPN", { domain: 'phala', label: '', token: 'PHA' }) 
// verifyAssetHubPortfolioChange("162WLLoopzLWSninv2FpegsfDvrTn3xBAT2FGEhwszHShJPx", { domain: 'phala', label: '', token: 'PHA' }) 
/**
 * XCM where the parachain no longer exists / is not indexed 
 * https://polkadot.subscan.io/xcm_message/polkadot-dcbfb4b249b0abd7b58efd6464450e6405503eca
 * PHA disappears through "withdraw", e.g. block: 6831351
 */ 
// verifyAssetHubPortfolioChange("129ahoNBbD53JrHC3aP6XXdWvTKxVyQo1PjqMcQ698sp3FdM", { domain: 'phala', label: '', token: 'PHA' }) 
// verifyAssetHubPortfolioChange("16M3S6cVeZ4pEjhUjErzp43NvmCCNnAMJhocYsBG3v8nFw9t", { domain: 'phala', label: '', token: 'PHA' }) 


// PEAQ
/**
 * Mostly EVM transactions...
 */
// XCM: PEAQ -> issue with cross chain transfers -> DAI -> DAI.wh. xcm messages ignored for now
// verifyAssetHubPortfolioChange("1333RgL47QYYkmJk1BHzfEF4hRE7Bd2Yf8P2HdV8Cn3p9hVh", { domain: 'peaq', label: '', token: 'PEAQ' })
/**
 * XCM of Moonbeam but not recognizable as such...
 */
// verifyAssetHubPortfolioChange("1228xdwBttfQ5LpT2rihE2FLJLAY2hu8jsGYzD2dgY25DkTe", { domain: 'peaq', label: '', token: 'PEAQ' })
// verifyAssetHubPortfolioChange("14ztyLQdP2B5ahuH9AipKSqvf29wXSf7jWhJ9mEP8cJXfmVw", { domain: 'peaq', label: '', token: 'PEAQ' })
// NOK withdrawals / deposits...
// verifyAssetHubPortfolioChange("15GMzoTZjgj1957aE7NPVUdZpdYfgntM5ryFobHLJWVwp4VP", { domain: 'peaq', label: '', token: 'PEAQ' })


// Unique
/**
 * there is some mechanism such that fees are lower than actually given
 * for each transaction there a deposit event returning some of the fees. e.g. https://unique.subscan.io/extrinsic/8210174-8
 * actual fee is 3.20996 not 3.2181
 * Also one should look at deposit and withdrawal events... not feasable
 *
 */
// verifyAssetHubPortfolioChange("16dHFQnXT8dZyGXSWFo3SDms6KBEEUDp2LgHx3vmqhVR3tXJ", { domain: 'unique', label: '', token: 'UNQ' })
// verifyAssetHubPortfolioChange("12jwmRZMbkKbyGfmu7LgWLpZkUoj4wy3Vmh48k17gEKRYfzk", { domain: 'unique', label: '', token: 'UNQ' })
// verifyAssetHubPortfolioChange("16MVJ7qYwZJdFc9XbXyrndn31xXhxQ9XkctUvmGKzeZACq2Q", { domain: 'unique', label: '', token: 'UNQ' })
// verifyAssetHubPortfolioChange("15iSPt39ba3nBN4ttyx9cCUFRnVxpALcUR5vHnqGzT46wjTd", { domain: 'unique', label: '', token: 'UNQ' })


// pendulum
// XCM transfers completely different!
// verifyAssetHubPortfolioChange("16aPu5eDzW5XTHQvixUUfZCAXiRXpFdiuRi49rcr4DGJmJmM", { domain: 'pendulum', label: '', token: 'PEN' })


// spiritnet
// verifyAssetHubPortfolioChange("12n5xSTNDB2WGTtv8Fcst2PeZPnJaM1zchR5w1ZJdDrbgqnV", { domain: 'spiritnet', label: '', token: 'KILT' })
// verifyAssetHubPortfolioChange("14igNr9LabUkxmMys8CSTqUyJaHWum4bjBCSPqZPgXdmFTPc", { domain: 'spiritnet', label: '', token: 'KILT' })
/**
 * balances upgraded -> balance doubled? "event_index": "5776680-279"
 * 4sjKoUyu8Bn5kkQAyqn82DscY7o55tQH65DficCPphxMwaWY
 */
// verifyAssetHubPortfolioChange("15pFynQaX8YTpX2YZcMDfymTygMtzvUVvLAgLdkxEDMqFHrn", { domain: 'spiritnet', label: '', token: 'KILT' })
// verifyAssetHubPortfolioChange("15uWH9p8mA3Ggfdt5z8kkJp1Dmama5rpKgrR6AgDzfygqNn1", { domain: 'spiritnet', label: '', token: 'KILT' })
// verifyAssetHubPortfolioChange("16PLqVKSrYhpXhVBZk1DJSGuCacr1W2nyBBiHZCtBYgse1Hi", { domain: 'spiritnet', label: '', token: 'KILT' })
