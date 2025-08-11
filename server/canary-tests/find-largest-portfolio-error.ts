import { SubscanApi } from "../src/server/blockchain/substrate/api/subscan.api";
import { createDIContainer } from "../src/server/di-container";
import { fetchPortfolioMovements } from "./helper/fetch-portfolio-movements";
import * as fs from "fs";
import { Wallet } from "./helper/wallet";
import { analysePortfolioChanges } from "./helper/analyze-portfolio-changes";
import * as subscanChains from "../res/gen/subscan-chains.json";
import { startStubs, stopStubs } from "./helper/fetch-portfolio-movements";
import { createApi, getApiClient } from "./helper/get-balances-at";

const zoomIntoErrorAssetsChange = async (
  address: string,
  chain: { domain: string; label: string; token: string },
  tokenOfInterest: string,
  interval?: { startBlock: number; endBlock: number },
  cachedData?: any,
  tolerance?: number,
) => {
  const { portfolioMovements, minBlock, maxBlock, unmatchedEvents } =
    cachedData?.portfolioMovements ??
    (await fetchPortfolioMovements(address, chain));
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
  const badIntervals = analysePortfolioChanges(
    chain.token,
    portfolioList,
    portfolioMovements,
  ).filter((r) => r.deviationAbs > tolerance);
  if (badIntervals.length === 0) {
    console.log("No issues found.");
    return;
  }
  const max = Math.max(...badIntervals.map((i) => i.deviationAbs));
  const intervalOfChoice = badIntervals.find((i) => i.deviationAbs === max);
  if (intervalOfChoice.endBlock - intervalOfChoice.startBlock > 1) {
    await zoomIntoErrorAssetsChange(
      address,
      chain,
      tokenOfInterest,
      intervalOfChoice,
      {
        portfolios,
        portfolioMovements: {
          portfolioMovements,
          minBlock,
          maxBlock,
          unmatchedEvents,
        },
        accountTokens,
      },
      tolerance,
    );
  } else {
    const block1 = await subscanApi.fetchBlock(
      chain.domain,
      interval.startBlock,
    );
    const block2 = await subscanApi.fetchBlock(chain.domain, interval.endBlock);
    console.log("from " + block1.timestamp + " to " + block2.timestamp);
    console.log("Finished : " + JSON.stringify(intervalOfChoice));
  }
};

const zoomIntoErrorTokensChange = async (
  address: string,
  chain: { domain: string; label: string; token: string },
  tokenUniqueId: string,
  tokenSymbol: string,
  tolerance = 0.01,
  withFees = true,
  interval?: { startBlock: number; endBlock: number },
  cachedData?: any,
) => {
  const { portfolioMovements, minBlock, maxBlock, unmatchedEvents } =
    cachedData?.portfolioMovements ??
    (await fetchPortfolioMovements(address, chain));
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
  const portfolios = await new Wallet().fetchTokenBalances(
    chain.domain,
    chain.token,
    address,
    blocksToFetch,
  );
  const badIntervals = analysePortfolioChanges(
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
    portfolioMovements,
  ).filter((r) => r.deviationPerPayment > tolerance);
  if (badIntervals.length === 0) {
    console.log("No issues found.");
    return;
  }
  const max = Math.max(...badIntervals.map((i) => i.deviationAbs));
  const intervalOfChoice = badIntervals.find((i) => i.deviationAbs === max);
  if (intervalOfChoice.endBlock - intervalOfChoice.startBlock > 1) {
    zoomIntoErrorTokensChange(
      address,
      chain,
      tokenUniqueId,
      tokenSymbol,
      tolerance,
      withFees,
      intervalOfChoice,
      {
        portfolioMovements: {
          portfolioMovements,
          minBlock,
          maxBlock,
          unmatchedEvents,
        },
      },
    );
  } else {
    const block1 = await subscanApi.fetchBlock(
      chain.domain,
      interval.startBlock,
    );
    const block2 = await subscanApi.fetchBlock(chain.domain, interval.endBlock);
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
    console.log("finished : " + JSON.stringify(intervalOfChoice));
  }
};

const zoomIntoErrorTokens = async (
  address: string,
  chainInfo: { domain: string; label: string; token: string },
  tokenUniqueId: string,
  tokenSymbol: string,
  tolerance = 0.5,
) => {
  const { portfolioMovements, unmatchedEvents, minBlock, maxBlock } =
    fs.existsSync(`./canary-tests/out-temp/portfolio-movements.json`)
      ? JSON.parse(
          fs.readFileSync(
            `./canary-tests/out-temp/portfolio-movements.json`,
            "utf-8",
          ),
        )
      : await fetchPortfolioMovements(address, chainInfo);
  if (!fs.existsSync(`./canary-tests/out-temp/portfolio-movements.json`)) {
    fs.writeFileSync(
      `./canary-tests/out-temp/portfolio-movements.json`,
      JSON.stringify(
        { portfolioMovements, unmatchedEvents, minBlock, maxBlock },
        null,
        2,
      ),
    );
  }
  zoomIntoErrorTokensChange(
    address,
    chainInfo,
    tokenUniqueId,
    tokenSymbol,
    tolerance,
    true,
    undefined,
    {
      portfolioMovements: {
        portfolioMovements,
        unmatchedEvents,
        minBlock,
        maxBlock,
      },
    },
  );
};
// zoomIntoErrorTokens("15GMzoTZjgj1957aE7NPVUdZpdYfgntM5ryFobHLJWVwp4VP", { domain: 'hydration', label: '', token: 'HDX' }, 'asset_registry/e4f2064efd114c35ce6939ef98789d88256e4ccf', 'MYTH', 0)

const zoomIntoErrorAssets = async (
  address: string,
  chainInfo: any,
  token: string,
  tolerance = 0.1,
) => {
  const { portfolioMovements, unmatchedEvents, minBlock, maxBlock } =
    fs.existsSync(`./canary-tests/out-temp/portfolio-movements.json`)
      ? JSON.parse(
          fs.readFileSync(
            `./canary-tests/out-temp/portfolio-movements.json`,
            "utf-8",
          ),
        )
      : await fetchPortfolioMovements(address, chainInfo);
  if (!fs.existsSync(`./canary-tests/out-temp/portfolio-movements.json`)) {
    fs.writeFileSync(
      `./canary-tests/out-temp/portfolio-movements.json`,
      JSON.stringify(
        { portfolioMovements, unmatchedEvents, minBlock, maxBlock },
        null,
        2,
      ),
    );
  }
  await zoomIntoErrorAssetsChange(
    address,
    chainInfo,
    token,
    undefined,
    {
      portfolioMovements: {
        portfolioMovements,
        unmatchedEvents,
        minBlock,
        maxBlock,
      },
    },
    tolerance,
  );
};

const findLargestPortfolioError = async () => {
  console.log("ENTRY findLargestPortfolioError");
  await startStubs();

  try {
    const wallet = process.env["wallet"];
    const chain = process.env["chain"];
    const tokenSymbol = process.env["token_symbol"];
    const tokenId = process.env["token_id"];
    if (!wallet || !chain || !tokenSymbol) {
      console.error("wallet, chain and, token_symbol are mandatory.");
    }
    createApi(chain);

    const nativeToken = subscanChains.chains.find(
      (t) => t.domain === chain,
    ).token;

    switch (chain) {
      case "hydration":
      case "bifrost":
        await zoomIntoErrorTokens(
          wallet,
          { domain: chain, label: "", token: nativeToken },
          tokenId,
          tokenSymbol,
          0,
        );
      default:
        await zoomIntoErrorAssets(
          wallet,
          { domain: chain, label: "", token: nativeToken },
          tokenSymbol,
          0,
        );
    }
  } finally {
    await stopStubs();
    getApiClient()?.disconnect();
    console.log("EXIT findLargestPortfolioError");
  }
};
findLargestPortfolioError();

// ASSET HUB
// testAssetMovement("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
/**
 * Burn event ignored because burn is also called thrown during by xcm. Difference 6 DOT
 */
// verifyAssetMovement("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
/**
 * XCM: Works but MYTH xcm transfers which are not recognized. Formatting of multi location does not match. Reason unclear.
 * https://polkadot.subscan.io/xcm_message/polkadot-bff42d3f55c8f50357f1cbb3448387a3101657ea
 */
// verifyAssetMovement("1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("13qSxtKtr54qebSQzf1c7MC9CwkkZMMFaXyHKq8LzjSjiU3M", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("13vg3Mrxm3GL9eXxLsGgLYRueiwFCiMbkdHBL4ZN5aob5D4N", { domain: 'assethub-polkadot', label: '', token: 'DOT' }) // ~very slow

// coretime
// verifyAssetMovement("15fTH34bbKGMUjF1bLmTqxPYgpg481imThwhWcQfCyktyBzL", { domain: 'coretime-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("16aXFECXjLKBbEAjGtF6cs9besGQ8Yk8o4RzvA5FRPJNHeHN", { domain: 'coretime-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("15mYsj6DpBno58jRoV5HCTiVPFBuWhDLdsWtq3LxwZrfaTEZ", { domain: 'coretime-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("15tkmix9R7ZRYGsLGV15mpZSbicPjmnhLdnUccAwfRi7RPVV", { domain: 'coretime-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("16aXFECXjLKBbEAjGtF6cs9besGQ8Yk8o4RzvA5FRPJNHeHN", { domain: 'coretime-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("1HwQbUpcr99UA6W7WBK86RtMHJTBWRazpxuYfRHyhSCbE1j", { domain: 'coretime-polkadot', label: '', token: 'DOT' })

// people
// verifyAssetMovement("16LviqDmEdn49UqeVSw3N1SjoJxRVV1EBbydbEqqaCvdtAsY", { domain: 'people-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("142nFphK2qW4AWxZYFZiKjirKBMZPFRsCYDe75Rv9YSCkDUW", { domain: 'people-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("14Gnp9cpb4mrXrpbCVNQSEPyL3QhoccGB9qpTRxqKWWMWSxn", { domain: 'people-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("15mYsj6DpBno58jRoV5HCTiVPFBuWhDLdsWtq3LxwZrfaTEZ", { domain: 'people-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("12ryo7Fp21tKkFQWJ2vSVMY2BH3t9syk65FUaywraHLs3T4T", { domain: 'people-polkadot', label: '', token: 'DOT' })

// collectives
// verifyAssetMovement("1L66uQMKFnXKSZx9pCD5o56GvvP1i2Qns7CaS2AaKp9mnwc", { domain: 'collectives-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("168BAPzMCWtzvbUVAXjDcJjZCtog7tmoMN2kRa7nusoxJeB8", { domain: 'collectives-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("12zsKEDVcHpKEWb99iFt3xrTCQQXZMu477nJQsTBBrof5k2h", { domain: 'collectives-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("14EQvBy9h8xGbh2R3ustnkfkF514E7wpmHtg27gDaTLM2str", { domain: 'collectives-polkadot', label: '', token: 'DOT' })
// verifyAssetMovement("13C7Ssy9QNJk515SFezaKMfhMRFrRcZWBhXA3oDq1AuKVds5", { domain: 'collectives-polkadot', label: '', token: 'DOT' })

// ACALA
// verifyAssetMovement("1UA2r4UWyAJfWyCEb39oevsUxuzB8XeriJSsdzVtoLNzddr", { domain: 'acala', label: '', token: 'ACA' })
/**
 * reward is also a transfer:
 * https://acala.subscan.io/account/13EXo5nS5kJMRHqghAcq1z3j3XpguLiWzvV8cbYSXXJsTBYy?tab=reward
 * https://acala.subscan.io/event?block=8089502
 */
// verifyAssetMovement("13EXo5nS5kJMRHqghAcq1z3j3XpguLiWzvV8cbYSXXJsTBYy", { domain: 'acala', label: '', token: 'ACA' })
// verifyAssetMovement("1sdEj2dBvsGUQ2MqiZWJ8hHss7cCZ4nFcrjE6xDBCtPYiJx", { domain: 'acala', label: '', token: 'ACA' })
// verifyAssetMovement("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", { domain: 'acala', label: '', token: 'ACA' })
// verifyAssetMovement("1sdEj2dBvsGUQ2MqiZWJ8hHss7cCZ4nFcrjE6xDBCtPYiJx", { domain: 'acala', label: '', token: 'ACA' })

// ASTAR
// verifyAssetMovement("13hDgWbatzrMmdPGz4F3Y63vP3qmdac7PUrujcN5a8nB6CkJ", { domain: 'astar', label: '', token: 'ASTR' })
// verifyAssetMovement("15tH5VV82YwsJPBGcBFmGvgkiBCkAzcCXbZLbZ7TkCJM6kdq", { domain: 'astar', label: '', token: 'ASTR' })
// verifyAssetMovement("16m3U19QHy39x5BBTR2FN9yh2k9LhUnS727N3wSH48P9wj8K", { domain: 'astar', label: '', token: 'ASTR' }) // slow
// verifyAssetMovement("153G4p8oHhKuVodS4pcQEgs23TrC9jfVueZ7npbL65JoFRYs", { domain: 'astar', label: '', token: 'ASTR' })
// verifyAssetMovement("15yZzmbMsogqqxVNNfe6t4LaYmjGWbPFDbADo23voJSKvywq", { domain: 'astar', label: '', token: 'ASTR' })
// verifyAssetMovement("13AxCbvHff9d9LBtdNZBT5f2JoiHVRaHyiuUwZMmnBuGrSE8", { domain: 'astar', label: '', token: 'ASTR' })

// MYTHOS
// verifyAssetMovement("0xf8683ecADdCb12891867CCDF4dbC96f47d62d67B", { domain: 'mythos', label: '', token: 'MYTH' })
// verifyAssetMovement("0x56F17ebFe6B126E9f196e7a87f74e9f026a27A1F", { domain: 'mythos', label: '', token: 'MYTH' })
// verifyAssetMovement("0xfd56a122ec50912811ec2856e6df5fd0a1581df2", { domain: 'mythos', label: '', token: 'MYTH' })
// verifyAssetMovement("0x5EE06FECF52b12c66b03700821FbBc9dD5680361", { domain: 'mythos', label: '', token: 'MYTH' })
// verifyAssetMovement("0xF6eAAdC72D1a58F735965EA196E4FA7029fC76dC", { domain: 'mythos', label: '', token: 'MYTH' })
// verifyAssetMovement("0x3359314e9dC3FE983a9f71AF25680fd6fe0CccC6", { domain: 'mythos', label: '', token: 'MYTH' }) // lot's of data.
// verifyAssetMovement("0xEcdbC924dFe6C6c7b2242890d0b4764dddBE40B1", { domain: 'mythos', label: '', token: 'MYTH' }) // lot's of data.
// verifyAssetMovement("0x7AdbF4458aaDa94129a898a142c4cda58BaEE04c", { domain: 'mythos', label: '', token: 'MYTH' }) // lot's of data.

// energywebx
// verifyAssetMovement("13KemmTsLpdz8sbdB8cL4Lw3PDVgy2UjEnayx72QgUbAcSRT", { domain: 'energywebx', label: '', token: 'EWT' })
// verifyAssetMovement("16dCndCe1hUGuqFNiBQdvmXtWTRN6MSf9s5wjiEkxTsBo5Jb", { domain: 'energywebx', label: '', token: 'EWT' })
// verifyAssetMovement("13VMMtNPxsTiJZ6rz5N9FJASnNg5iuEamf5SBBhiDTQJBKhk", { domain: 'energywebx', label: '', token: 'EWT' }) // lot's of data.
// verifyAssetMovement("1gQCP9rT9dfQKCnneh5w8mqxCH5E9XWXnt17wJqGLyZ7eEL", { domain: 'energywebx', label: '', token: 'EWT' }) // lot's of data.

// neuroweb
// verifyAssetMovement("16MRsnWMXvBiHK8FUu9GMNBaVFbY9RpVcCWbviRjL1ogGWQ7", { domain: 'neuroweb', label: '', token: 'NEURO' })
// verifyAssetMovement("15gPguU3rf2CdWwqahgc3HYk6R9bw5HSdDqYxoNyG9Enrc5V", { domain: 'neuroweb', label: '', token: 'NEURO' })
// verifyAssetMovement("12pGnMsHHe4cUVTnBpXEhxyfL59zcDSEk4xLA9EgYFUgS6Uq", { domain: 'neuroweb', label: '', token: 'NEURO' })
// verifyAssetMovement("14BSK3tU1iqT7U2UfdZGsQ7duLRUBXK6W4sUTUd5J7DQPoNz", { domain: 'neuroweb', label: '', token: 'NEURO' })

/////////////// everything ok until here

// Hydration
// verifyTokenMovement("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", { domain: 'hydration', label: '', token: 'HDX' })
// verifyTokenMovement("16882iTH5FHdH2ka552Rr6yUGUSvKPvQHBWAYLXjiCihVpgf", { domain: 'hydration', label: '', token: 'HDX' })
// KK verifyTokenMovement("1po4rmTmihcdumpP7XP4ZnexNvaRX1bHoNawndvMk4udC1G", { domain: 'hydration', label: '', token: 'HDX' })
// KK verifyTokenMovement("16CzpgW3YoR8FQYLromGxfVhare7JyLBsnUcm5i8GZocfujb", { domain: 'hydration', label: '', token: 'HDX' })
// verifyTokenMovement("12R6XdCSw3HX59CX2kmCYzAkVrf5u4AZd7YExSjwMLNzm2da", { domain: 'hydration', label: '', token: 'HDX' }, 0.3, true)
// KK verifyTokenMovement("12ZuLmUFrpmWW9CHTED925mnuZnK5JyZPqnsooq9pjuWBSYX", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyTokenMovement("133cogzsFo7jnwp7jENBnygfj5GxnQi4hSZdNQtzuteULt4S", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyTokenMovement("14XhPq7NHe6vGGxuQ21hcosA2XwTNtA9mWr5n5FNXkQZDS7U", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyTokenMovement("13sJGSFAPsKbXrkXuZe4KU6Vb611NXtRjRwnp4e8bQNELhYV", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyTokenMovement("1Zn6CU4CCHLDtrgxGsKYt65Ujd1vc72ydAxL5cUpymGHZoF", { domain: 'hydration', label: '', token: 'HDX' });
// OK verifyTokenMovement("13BnzcNSL59RgCTXy4NZug78WXa4Yp6S2AxfAx34qsWEMvDR", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyTokenMovement("1244idMo96seN3NTMVFpnfsXXHqx4zrztysAfww7UMMgaj2v", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyTokenMovement("13jFF8C4JzKQt42qiPyTaBAVF5QdwnzFw6d8t7WUxdKSB4Yo", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyTokenMovement("1xueyfG9g4is3jVsnkH73x31vWpKHHRowtKvyqb2scQkdC3", { domain: 'hydration', label: '', token: 'HDX' })
// verifyTokenMovement("14QLEDMkLp7wt6ZfyvZA5mq59xHzMUTQrXSikFM2RZ78Cf3K", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyTokenMovement("12YGU15jahiyNje51yP2JA7x6fWv4S1Kr3DgpjBPH2GN184r", { domain: 'hydration', label: '', token: 'HDX' })
// verifyTokenMovement("13VyzGJCffWkeyrtaEtJtW6ySXACb34onwVJL7cYiTHWGEJK", { domain: 'hydration', label: '', token: 'HDX' })
// verifyTokenMovement("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", { domain: 'hydration', label: '', token: 'HDX' })
// OK verifyTokenMovement("1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", { domain: 'hydration', label: '', token: 'HDX' })
// verifyTokenMovement("131d4YS25qpuXiHrfJibuFYXwZrzwxpvU1ahvr3TJFNYcmfk", { domain: 'hydration', label: '', token: 'HDX' }) // jakub
//verifyTokenMovement("13b6hRRYPHTxFzs9prvL2YGHQepvd4YhdDb9Tc7khySp3hMN", { domain: 'hydration', label: '', token: 'HDX' })
//verifyTokenMovement("15rSJtfCbB3MtWmW5pNnRhNeJENSQX9hLXUikkAee6mJVC9j", { domain: 'hydration', label: '', token: 'HDX' })
//verifyTokenMovement("16MRsnWMXvBiHK8FUu9GMNBaVFbY9RpVcCWbviRjL1ogGWQ7", { domain: 'hydration', label: '', token: 'HDX' })
// verifyTokenMovement("12ZuLmUSUP6gHGboHBoBGPwC8KtxLLwizLhWSdJMbPuzvMhv", { domain: 'hydration', label: '', token: 'HDX' })

// Bifrost
/**
 * vtoken Minted event 3917920-5 cannot be found via subscan.
 * also crossinout events are missing. there's no clear mapping from multi location to token, e.g. : 6672187-6
 */
// verifyTokenMovement("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", { domain: 'bifrost', label: '', token: 'BNC' })
/**
 * some events not showing up e.g. 4193678-18 (vGLMR Minted),
 * also vsDOT
 */
// verifyTokenMovement("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", { domain: 'bifrost', label: '', token: 'BNC' })
// OK, large diff due to tx fees(?) BNC verifyTokenMovement("1RRBm6aEAxYXjjacerrEyNxvhDZLbr9PJRvtbxD3NkgTB8S", { domain: 'bifrost', label: '', token: 'BNC' })
/**
 * Deposit event unclear provenance: https://bifrost.subscan.io/block/8207115?tab=event
 * Also missing vtoken minting event.
 */
// NOK: BNC, vBNC verifyTokenMovement("15b7Ko56RgVBVWB9UXEnW4LhS2AAALRmcVpgx26Wr5yzVbeS", { domain: 'bifrost', label: '', token: 'BNC' })
// OK! verifyTokenMovement("12TiTLQYFBsb2EUdaxFdcvo78gpkhajnuv7Jm8Aoy7c4z1YV", { domain: 'bifrost', label: '', token: 'BNC' })

// phala
// fetchAssetChangesExpectedVSActual("1eo82wr76n25UXYHNa9hym1ZTHeK4oBrNMcz97m71H85qfP", { domain: 'phala', label: '', token: 'PHA' })
// fetchAssetChangesExpectedVSActual("14EAEgGrbX3KCgyjBZRyB5qgYpuFHLB5AC8TX7hYLPRT1YPN", { domain: 'phala', label: '', token: 'PHA' })
// fetchAssetChangesExpectedVSActual("162WLLoopzLWSninv2FpegsfDvrTn3xBAT2FGEhwszHShJPx", { domain: 'phala', label: '', token: 'PHA' })
/**
 * XCM which is not indexed via the respective address:
 * https://phala.subscan.io/xcm_message/polkadot-a6a70e527fbfc76f0b4eb89426d0ac61a3bcfcc6
 */
// fetchAssetChangesExpectedVSActual("129ahoNBbD53JrHC3aP6XXdWvTKxVyQo1PjqMcQ698sp3FdM", { domain: 'phala', label: '', token: 'PHA' })
// fetchAssetChangesExpectedVSActual("16M3S6cVeZ4pEjhUjErzp43NvmCCNnAMJhocYsBG3v8nFw9t", { domain: 'phala', label: '', token: 'PHA' })

// PEAQ
/**
 * Mostly EVM transactions...
 */
// XCM: PEAQ -> issue with cross chain transfers -> DAI -> DAI.wh. xcm messages ignored for now
// fetchAssetChangesExpectedVSActual("1333RgL47QYYkmJk1BHzfEF4hRE7Bd2Yf8P2HdV8Cn3p9hVh", { domain: 'peaq', label: '', token: 'PEAQ' })
/**
 * XCM of Moonbeam but not recognizable as such...
 */
// fetchAssetChangesExpectedVSActual("1228xdwBttfQ5LpT2rihE2FLJLAY2hu8jsGYzD2dgY25DkTe", { domain: 'peaq', label: '', token: 'PEAQ' })
// NOK withdrawals / deposits...
// fetchAssetChangesExpectedVSActual("15GMzoTZjgj1957aE7NPVUdZpdYfgntM5ryFobHLJWVwp4VP", { domain: 'peaq', label: '', token: 'PEAQ' })

// Unique
/**
 * there is some mechanism such that fees are lower than actually given
 * for each transaction there a deposit event returning some of the fees. e.g. https://unique.subscan.io/extrinsic/8210174-8
 * actual fee is 3.20996 not 3.2181
 * Also one should look at deposit and withdrawal events... not feasable
 *
 */
// fetchAssetChangesExpectedVSActual("16dHFQnXT8dZyGXSWFo3SDms6KBEEUDp2LgHx3vmqhVR3tXJ", { domain: 'unique', label: '', token: 'UNQ' })
// fetchAssetChangesExpectedVSActual("12jwmRZMbkKbyGfmu7LgWLpZkUoj4wy3Vmh48k17gEKRYfzk", { domain: 'unique', label: '', token: 'UNQ' })
// fetchAssetChangesExpectedVSActual("16MVJ7qYwZJdFc9XbXyrndn31xXhxQ9XkctUvmGKzeZACq2Q", { domain: 'unique', label: '', token: 'UNQ' })
// fetchAssetChangesExpectedVSActual("15iSPt39ba3nBN4ttyx9cCUFRnVxpALcUR5vHnqGzT46wjTd", { domain: 'unique', label: '', token: 'UNQ' })

// pendulum
// XCM transfers completely different!
// fetchAssetChangesExpectedVSActual("16aPu5eDzW5XTHQvixUUfZCAXiRXpFdiuRi49rcr4DGJmJmM", { domain: 'pendulum', label: '', token: 'PEN' })

// spiritnet
// fetchAssetChangesExpectedVSActual("12n5xSTNDB2WGTtv8Fcst2PeZPnJaM1zchR5w1ZJdDrbgqnV", { domain: 'spiritnet', label: '', token: 'KILT' })
// fetchAssetChangesExpectedVSActual("14igNr9LabUkxmMys8CSTqUyJaHWum4bjBCSPqZPgXdmFTPc", { domain: 'spiritnet', label: '', token: 'KILT' })
/**
 * balances upgraded -> balance doubled? "event_index": "5776680-279"
 * 4sjKoUyu8Bn5kkQAyqn82DscY7o55tQH65DficCPphxMwaWY
 */
// fetchAssetChangesExpectedVSActual("15pFynQaX8YTpX2YZcMDfymTygMtzvUVvLAgLdkxEDMqFHrn", { domain: 'spiritnet', label: '', token: 'KILT' })
// fetchAssetChangesExpectedVSActual("15uWH9p8mA3Ggfdt5z8kkJp1Dmama5rpKgrR6AgDzfygqNn1", { domain: 'spiritnet', label: '', token: 'KILT' })
// fetchAssetChangesExpectedVSActual("16PLqVKSrYhpXhVBZk1DJSGuCacr1W2nyBBiHZCtBYgse1Hi", { domain: 'spiritnet', label: '', token: 'KILT' })
