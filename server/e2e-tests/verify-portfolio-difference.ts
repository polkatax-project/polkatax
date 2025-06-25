import { createDIContainer } from "../src/server/di-container";
import { SubscanApi } from "../src/server/blockchain/substrate/api/subscan.api";
import { fetchPayments } from "./fetch-payments";
import { Wallet } from "./wallet";
import * as fs from "fs";
import { verifyPortfolioHistory } from "./helper/verify-portfolio-history";
import { SubscanEvent } from "../src/server/blockchain/substrate/model/subscan-event";
import { SubscanService } from "../src/server/blockchain/substrate/api/subscan.service";

const verifyPortfolioChange = async (address: string, chain: { domain: string, label: string, token: string }, tolerance = 0.5) => {
  const { payments, minBlock, maxBlock, unmatchedEvents } = await fetchPayments(address, chain);
  const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi")
  const timestamps = []
  const blocksToFetch = []
  const chunks = 1
  for (let blockNum = minBlock; blockNum <= maxBlock; blockNum+=Math.ceil((maxBlock- minBlock) / chunks)) {
    const block = await subscanApi.fetchBlock(chain.domain, blockNum)
    timestamps.push(block.timestamp)
    blocksToFetch.push(blockNum)
  }
  const portfolios = await (new Wallet().fetchPortfolios(chain.domain, chain.token, address, blocksToFetch))
  // console.log(JSON.stringify(portfolios, null, 4))
  verifyPortfolioHistory(address, chain.domain, undefined, portfolios.map(p => ({
    timestamp: timestamps[portfolios.indexOf(p)], balances: p.values, blockNumber: blocksToFetch[portfolios.indexOf(p)]
  })), payments, unmatchedEvents, tolerance)
}

const verifyAssetHubPortfolioChange = async (address: string, chain: { domain: string, label: string, token: string }) => {
  const { payments, minBlock, maxBlock, unmatchedEvents } = await fetchPayments(address, chain);
  const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi")
  const portfolioNow = await subscanApi.fetchAccountTokens(chain.domain, address)
  const mergedPortfolio = [...portfolioNow.builtin ?? [], ...portfolioNow.native ?? [], ...portfolioNow.assets ?? []]
  const relevantTokens = mergedPortfolio
    .filter(b => b.unique_id.startsWith('standard_assets/') || b.symbol === chain.token)
    .map(b => ({ unique_id: b.unique_id, symbol: b.symbol, decimals: b.decimals, asset_id: Number(b.asset_id) }))
  
  const portfolios: { timestamp: number, blockNumber?: number ,balances: { symbol: string, balance: number }[] }[] = []
  const numberChunks = 1
  for (let blockNumber = minBlock; blockNumber <= maxBlock; blockNumber += Math.ceil((maxBlock - minBlock) / numberChunks)) {
    const block = await subscanApi.fetchBlock(chain.domain, blockNumber)
    const portfolio = await (new Wallet().getAssetBalances(chain.domain, chain.token, address, blockNumber, relevantTokens))
    portfolios.push({
      timestamp: block.timestamp, balances: portfolio.values, blockNumber
    })
  }
  for (let token of relevantTokens) {
    const portfolioList = [...portfolios.map(p => ({ blockNumber: p.blockNumber, timestamp: p.timestamp, balances: p.balances.filter(v => v.symbol === token.symbol) }))]
    verifyPortfolioHistory(address, chain.domain, undefined, portfolioList, payments, unmatchedEvents, token.symbol === chain.token ? 0.5 : 0.05)
  }
}

const assetHubZoomInError = async (address: string, chain: { domain: string, label: string, token: string },
  tokenOfInterest: string,
  interval?: { startBlock: number, endBlock: number},
  cachedData?: any
) => {
  const { payments, minBlock, maxBlock, unmatchedEvents } = cachedData?.payments ?? await fetchPayments(address, chain);
  const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi")
  const accountTokens = cachedData?.accountTokens ?? await subscanApi.fetchAccountTokens(chain.domain, address)
  const mergedPortfolio = [...accountTokens.builtin ?? [], ...accountTokens.native ?? [], ...accountTokens.assets ?? []]
  const relevantToken = mergedPortfolio
    .filter(b => b.symbol === tokenOfInterest)
    .map(b => ({ unique_id: b.unique_id, symbol: b.symbol, decimals: b.decimals, asset_id: Number(b.asset_id) }))[0]
  
  const blocks = interval ? [ interval.startBlock, interval.endBlock ] : [minBlock, maxBlock]
  const portfolios: { timestamp: number, blockNumber?: number ,balances: { symbol: string, balance: number }[] }[] = []

  const timestamps = []
  const blocksToFetch = [blocks[0], Math.floor((blocks[1] - blocks[0]) / 2) + blocks[0], blocks[1]]

  for (let blockNumber of blocksToFetch) {
    const block = await subscanApi.fetchBlock(chain.domain, blockNumber)
    timestamps.push(block.timestamp)
    const cachedPortfolio = cachedData?.portfolios.find(p => p.blockNumber === blockNumber)
    const balances = cachedPortfolio?.balances ?? (await new Wallet().getAssetBalances(chain.domain, chain.token, address, blockNumber, [relevantToken])).values
    portfolios.push({
      timestamp: block.timestamp, balances, blockNumber
    })
  }
  const portfolioList = [...portfolios.map(p => ({ blockNumber: p.blockNumber, timestamp: p.timestamp, balances: p.balances.filter(v => v.symbol === relevantToken.symbol) }))]
  const badIntervals = verifyPortfolioHistory(address, chain.domain, undefined, portfolioList, payments, unmatchedEvents, relevantToken.symbol === chain.token ? 0.5 : 0.001)
  if (badIntervals.length === 0) {
    console.log("No issues found.")
    return
  }
  const max = Math.max(...badIntervals.map(i => i.deviation))
  const intervalOfChoice = badIntervals.find(i => i.deviation === max)
  if (intervalOfChoice.endBlock - intervalOfChoice.startBlock > 1) {
    assetHubZoomInError(address, chain, tokenOfInterest, intervalOfChoice, { portfolios, payments: { payments, minBlock, maxBlock, unmatchedEvents }, accountTokens })
  } else {
    console.log("Finished : " + JSON.stringify(intervalOfChoice))
  }
}

const portfolioZoomInError = async (address: string, chain: { domain: string, label: string, token: string }, 
  tokenSymbol: string,
  tolerance = 0.01, 
  interval?: { startBlock: number, endBlock: number},
  cachedData?: any
) => {
  const { payments, minBlock, maxBlock, unmatchedEvents } = cachedData?.payments ?? await fetchPayments(address, chain);
  const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi")
  const blocks = interval ? [ interval.startBlock, interval.endBlock ] : [minBlock, maxBlock]
  const timestamps = []
  const blocksToFetch = [blocks[0], Math.floor((blocks[1] - blocks[0]) / 2) + blocks[0], blocks[1]]
  for (const blockNum of blocksToFetch) {
    const block = await subscanApi.fetchBlock(chain.domain, blockNum)
    timestamps.push(block.timestamp)
  }
  const portfolios = await (new Wallet().fetchPortfolios(chain.domain, chain.token, address, blocksToFetch))
  const badIntervals = verifyPortfolioHistory(address, chain.domain, "", portfolios.map(p => ({
    timestamp: timestamps[portfolios.indexOf(p)], balances: [p.values.find(b => b.symbol === tokenSymbol) ?? { symbol: tokenSymbol, balance: 0 }], blockNumber: blocksToFetch[portfolios.indexOf(p)]
  })), payments, unmatchedEvents, tolerance)
  if (badIntervals.length === 0) {
    console.log("No issues found.")
    return
  }
  const max = Math.max(...badIntervals.map(i => i.deviation))
  const intervalOfChoice = badIntervals.find(i => i.deviation === max)
  if (intervalOfChoice.endBlock - intervalOfChoice.startBlock > 1) {
    portfolioZoomInError(address ,chain,  tokenSymbol, tolerance, intervalOfChoice, { payments: { payments, minBlock, maxBlock, unmatchedEvents }})
  } else {
    const block1= await subscanApi.fetchBlock(chain.domain, interval.startBlock)
    const block2 = await subscanApi.fetchBlock(chain.domain, interval.endBlock)
    const matchingPayments = payments.filter(
      (p) => p.timestamp > block1.timestamp && p.timestamp <= block2.timestamp,
    );
    console.log(JSON.stringify(portfolios))
    fs.writeFileSync(`./e2e-tests/out/payments.json`, JSON.stringify({ payments, unmatchedEvents }, null, 2))
    fs.writeFileSync(`./e2e-tests/out/matchingPayments.json`, JSON.stringify(matchingPayments, null, 2))
    console.log("finished : " + JSON.stringify(intervalOfChoice))
  }
}

const verifyNativeTokenBalanceChange = async (address: string, chain: { domain: string, label: string, token: string }, tolerance = 0.01) => {
  const { payments, minBlock, maxBlock, unmatchedEvents } = await fetchPayments(address, chain);
  const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi")
  const blocks =  [minBlock, maxBlock]
  const timestamps = []
  for (let idx = 0; idx < blocks.length; idx++) {
    const block = await subscanApi.fetchBlock(chain.domain, blocks[idx])
    timestamps.push(block.timestamp)
  }
  const portfolios = await (new Wallet().fetchNativeTokenBalances(chain.domain, chain.token, address, blocks))
  console.log(JSON.stringify(portfolios, null, 4))
  verifyPortfolioHistory(address, chain.domain, chain.token, portfolios.map(p => ({
    timestamp: timestamps[portfolios.indexOf(p)], balances: p.values
  })), payments, unmatchedEvents, tolerance)
}


// BIFROST
// OK! verifyPortfolioChange("1RRBm6aEAxYXjjacerrEyNxvhDZLbr9PJRvtbxD3NkgTB8S", { domain: 'bifrost', label: '', token: 'BNC' })
// almost OK verifyPortfolioChange("5CFwQqMnG61MkaSS96tW9vU2JiaV2YPHve2EtFA5SgY4SAts", { domain: 'bifrost', label: '', token: 'BNC' }) -> missing event locked
// OK verifyPortfolioChange("5GeJMTfNpe2mmJgnxHoYJDVvNFcn8X4fbdtVPHVonFSX9tH7", { domain: 'bifrost', label: '', token: 'BNC' })
// verifyPortfolioChange("15b7Ko56RgVBVWB9UXEnW4LhS2AAALRmcVpgx26Wr5yzVbeS", { domain: 'bifrost', label: '', token: 'BNC' }) -> missing  5804444-8	5804444
// OK verifyPortfolioChange("12TiTLQYFBsb2EUdaxFdcvo78gpkhajnuv7Jm8Aoy7c4z1YV", { domain: 'bifrost', label: '', token: 'BNC' })
// OK verifyAssetPortfolioChange4Hydration("16882iTH5FHdH2ka552Rr6yUGUSvKPvQHBWAYLXjiCihVpgf", { domain: 'hydration', label: '', token: 'HDX' })

// HYDRATION
// OK ! verifyPortfolioChange("5GeJMTfNpe2mmJgnxHoYJDVvNFcn8X4fbdtVPHVonFSX9tH7", { domain: 'hydration', label: '', token: 'HDX' }) 
// almost ok verifyPortfolioChange("5CFwQqMnG61MkaSS96tW9vU2JiaV2YPHve2EtFA5SgY4SAts", { domain: 'hydration', label: '', token: 'HDX' }) -> ZTG missing
// aslomst ok 40k HDX! verifyPortfolioChange("1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", { domain: 'hydration', label: '', token: 'HDX' }) // Leemo
// OK ! verifyPortfolioChange("12iyS9DpPLCbdt1ae136owqNPmcfYvkygeT6VmdtkbSv2ozq", { domain: 'hydration', label: '', token: 'HDX' })
// ALMOST OK verifyPortfolioChange("131d4YS25qpuXiHrfJibuFYXwZrzwxpvU1ahvr3TJFNYcmfk", { domain: 'hydration', label: '', token: 'HDX' }) -> HDX  // jakub

// portfolioZoomInError("131d4YS25qpuXiHrfJibuFYXwZrzwxpvU1ahvr3TJFNYcmfk", { domain: 'hydration', label: '', token: 'HDX' }, '2-Pool')

// ASSET HUB
// OK verifyAssetHubPortfolioChange("5GeJMTfNpe2mmJgnxHoYJDVvNFcn8X4fbdtVPHVonFSX9tH7", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
// OK verifyAssetHubPortfolioChange("5CFwQqMnG61MkaSS96tW9vU2JiaV2YPHve2EtFA5SgY4SAts", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
// OK verifyAssetHubPortfolioChange("1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
// OK verifyAssetHubPortfolioChange("13qSxtKtr54qebSQzf1c7MC9CwkkZMMFaXyHKq8LzjSjiU3M", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
// OK verifyAssetHubPortfolioChange("13vg3Mrxm3GL9eXxLsGgLYRueiwFCiMbkdHBL4ZN5aob5D4N", { domain: 'assethub-polkadot', label: '', token: 'DOT' })



