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

const verifyPortfolioChange = async (address: string, chain: { domain: string, label: string, token: string }, tolerance = 0.5, useFees = true) => {
  const { payments, minBlock, maxBlock, unmatchedEvents } = await fetchPayments(address, chain);
  fs.writeFileSync(`./e2e-tests/out/all.json`, JSON.stringify({ payments, unmatchedEvents, minBlock, maxBlock }, null, 2))

  /*let { payments, unmatchedEvents } = JSON.parse(fs.readFileSync(`./e2e-tests/out/payments.json`, 'utf-8'))
  payments = payments.filter(p => !p.transfers.some(t => t.destChain === 'hydration'))
  const minBlock = payments.reduce((curr, next) => Math.min(curr, next.block), Number.MAX_SAFE_INTEGER)
  const maxBlock = 8197543 // payments.reduce((curr, next) => Math.max(curr, next.block), 0)*/

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
  verifyPortfolioHistory(address, chain.domain, useFees ? chain.token : undefined, portfolios.map(p => ({
    timestamp: timestamps[portfolios.indexOf(p)], balances: p.values, blockNumber: blocksToFetch[portfolios.indexOf(p)]
  })), payments, unmatchedEvents, tolerance)
}

const verifyAssetHubPortfolioChange = async (address: string, chain: { domain: string, label: string, token: string }) => {
  const { payments, minBlock, maxBlock, unmatchedEvents } = await fetchPayments(address, chain);
  fs.writeFileSync(`./e2e-tests/out/all.json`, JSON.stringify({ payments, unmatchedEvents, minBlock, maxBlock }, null, 2))

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
    verifyPortfolioHistory(address, chain.domain, chain.token, portfolioList, payments, unmatchedEvents, token.symbol === chain.token ? 0.5 : 0.05)
  }
}

const assetHubZoomInError = async (address: string, chain: { domain: string, label: string, token: string },
  tokenOfInterest: string,
  interval?: { startBlock: number, endBlock: number},
  cachedData?: any,
  tolerance?: number
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
    const cachedPortfolio = cachedData?.portfolios?.find(p => p.blockNumber === blockNumber)
    const balances = cachedPortfolio?.balances ?? (await new Wallet().getAssetBalances(chain.domain, chain.token, address, blockNumber, [relevantToken])).values
    portfolios.push({
      timestamp: block.timestamp, balances, blockNumber
    })
  }
  const portfolioList = [...portfolios.map(p => ({ blockNumber: p.blockNumber, timestamp: p.timestamp, balances: p.balances.filter(v => v.symbol === relevantToken.symbol) }))]
  const badIntervals = verifyPortfolioHistory(address, chain.domain, chain.token, portfolioList, payments, unmatchedEvents, tolerance ?? 0.1)
  if (badIntervals.length === 0) {
    console.log("No issues found.")
    return
  }
  const max = Math.max(...badIntervals.map(i => i.deviation))
  const intervalOfChoice = badIntervals.find(i => i.deviation === max)
  if (intervalOfChoice.endBlock - intervalOfChoice.startBlock > 1) {
    assetHubZoomInError(address, chain, tokenOfInterest, intervalOfChoice, { portfolios, payments: { payments, minBlock, maxBlock, unmatchedEvents }, accountTokens }, tolerance)
  } else {
    console.log("Finished : " + JSON.stringify(intervalOfChoice))
  }
}

const portfolioZoomInError = async (address: string, chain: { domain: string, label: string, token: string }, 
  tokenSymbol: string,
  tolerance = 0.01, 
  withFees = true,
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
  const badIntervals = verifyPortfolioHistory(address, chain.domain, withFees ? chain.token : '', portfolios.map(p => ({
    timestamp: timestamps[portfolios.indexOf(p)], balances: [p.values.find(b => b.symbol === tokenSymbol) ?? { symbol: tokenSymbol, balance: 0 }], blockNumber: blocksToFetch[portfolios.indexOf(p)]
  })), payments, unmatchedEvents, tolerance)
  if (badIntervals.length === 0) {
    console.log("No issues found.")
    return
  }
  const max = Math.max(...badIntervals.map(i => i.deviation))
  const intervalOfChoice = badIntervals.find(i => i.deviation === max)
  if (intervalOfChoice.endBlock - intervalOfChoice.startBlock > 1) {
    portfolioZoomInError(address ,chain,  tokenSymbol, tolerance, withFees, intervalOfChoice, { payments: { payments, minBlock, maxBlock, unmatchedEvents }})
  } else {
    const block1= await subscanApi.fetchBlock(chain.domain, interval.startBlock)
    const block2 = await subscanApi.fetchBlock(chain.domain, interval.endBlock)
    const matchingPayments = payments.filter(
      (p) => p.timestamp > block1.timestamp && p.timestamp <= block2.timestamp,
    );
    console.log(JSON.stringify(portfolios))
    //fs.writeFileSync(`./e2e-tests/out/payments.json`, JSON.stringify({ payments, unmatchedEvents }, null, 2))
    //fs.writeFileSync(`./e2e-tests/out/matchingPayments.json`, JSON.stringify(matchingPayments, null, 2))
    console.log("finished : " + JSON.stringify(intervalOfChoice))
  }
}


// BIFROST -> OK
// OK !! verifyPortfolioChange("1RRBm6aEAxYXjjacerrEyNxvhDZLbr9PJRvtbxD3NkgTB8S", { domain: 'bifrost', label: '', token: 'BNC' })
// OK !! verifyPortfolioChange("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", { domain: 'bifrost', label: '', token: 'BNC' }) 
// OK !!! verifyPortfolioChange("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", { domain: 'bifrost', label: '', token: 'BNC' })
// OK !!! verifyPortfolioChange("15b7Ko56RgVBVWB9UXEnW4LhS2AAALRmcVpgx26Wr5yzVbeS", { domain: 'bifrost', label: '', token: 'BNC' }) 
// OK !!! verifyPortfolioChange("12TiTLQYFBsb2EUdaxFdcvo78gpkhajnuv7Jm8Aoy7c4z1YV", { domain: 'bifrost', label: '', token: 'BNC' })


// HYDRATION -> NOK
// OK ! verifyPortfolioChange("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", { domain: 'hydration', label: '', token: 'HDX' }) 
//verifyPortfolioChange("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", { domain: 'hydration', label: '', token: 'HDX' }) //-> ZTG missing
// ~40k miracle at block 4355799 HDX! verifyPortfolioChange("1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", { domain: 'hydration', label: '', token: 'HDX' }) // Leemo
// OK !! verifyPortfolioChange("12iyS9DpPLCbdt1ae136owqNPmcfYvkygeT6VmdtkbSv2ozq", { domain: 'hydration', label: '', token: 'HDX' })
// Mostly OK! verifyPortfolioChange("131d4YS25qpuXiHrfJibuFYXwZrzwxpvU1ahvr3TJFNYcmfk", { domain: 'hydration', label: '', token: 'HDX' }) // jakub
// OK!! verifyPortfolioChange("12R6XdCSw3HX59CX2kmCYzAkVrf5u4AZd7YExSjwMLNzm2da", { domain: 'hydration', label: '', token: 'HDX' }, 0.3, true) 


const zoomIntoError = async (address: string, chainInfo: any, token: string, tolerance = 0.5) => {
  const { payments, unmatchedEvents, minBlock, maxBlock } = JSON.parse(fs.readFileSync(`./e2e-tests/out/all.json`, 'utf-8'))
  portfolioZoomInError(address, chainInfo, token, tolerance, true,
   undefined,
    { payments: { payments, unmatchedEvents, minBlock, maxBlock } }
  )
}
//zoomIntoError("15tH5VV82YwsJPBGcBFmGvgkiBCkAzcCXbZLbZ7TkCJM6kdq", { domain: 'astar', label: '', token: 'ASTR' }, 'ASTR')*/

const ahZoomIntoError = async (address: string, chainInfo: any, token: string, tolerance = 0.1) => {
  const { payments, unmatchedEvents, minBlock, maxBlock } = JSON.parse(fs.readFileSync(`./e2e-tests/out/all.json`, 'utf-8'))
  assetHubZoomInError(address, chainInfo, token, 
   undefined,
    { payments: { payments, unmatchedEvents, minBlock, maxBlock } },
    tolerance
  )
}
// ahZoomIntoError("0x56F17ebFe6B126E9f196e7a87f74e9f026a27A1F",  { domain: 'mythos', label: '', token: 'MYTH' }, 'MYTH', 0.0001)

// ASSET HUB -> OK
//assetHubZoomInError("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", { domain: 'assethub-polkadot', label: '', token: 'DOT' }, 'USDt')
// OK ! verifyAssetHubPortfolioChange("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
// OK ! verifyAssetHubPortfolioChange("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
// OK! USDC alt token! verifyAssetHubPortfolioChange("1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
// OK ! verifyAssetHubPortfolioChange("13qSxtKtr54qebSQzf1c7MC9CwkkZMMFaXyHKq8LzjSjiU3M", { domain: 'assethub-polkadot', label: '', token: 'DOT' })
// OK ! verifyAssetHubPortfolioChange("13vg3Mrxm3GL9eXxLsGgLYRueiwFCiMbkdHBL4ZN5aob5D4N", { domain: 'assethub-polkadot', label: '', token: 'DOT' })

// ACALA
// OK ! verifyPortfolioChange("1UA2r4UWyAJfWyCEb39oevsUxuzB8XeriJSsdzVtoLNzddr", { domain: 'acala', label: '', token: 'ACA' })
// OK ! verifyPortfolioChange("13EXo5nS5kJMRHqghAcq1z3j3XpguLiWzvV8cbYSXXJsTBYy", { domain: 'acala', label: '', token: 'ACA' })
// OK ! verifyPortfolioChange("1sdEj2dBvsGUQ2MqiZWJ8hHss7cCZ4nFcrjE6xDBCtPYiJx", { domain: 'acala', label: '', token: 'ACA' })
// OK ! verifyPortfolioChange("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", { domain: 'acala', label: '', token: 'ACA' })
// OK ! verifyPortfolioChange("1sdEj2dBvsGUQ2MqiZWJ8hHss7cCZ4nFcrjE6xDBCtPYiJx", { domain: 'acala', label: '', token: 'ACA' })

// ASTAR -> NOK!!!
// OK !! verifyAssetHubPortfolioChange("13hDgWbatzrMmdPGz4F3Y63vP3qmdac7PUrujcN5a8nB6CkJ", { domain: 'astar', label: '', token: 'ASTR' })
// NOK very large !! verifyAssetHubPortfolioChange("15tH5VV82YwsJPBGcBFmGvgkiBCkAzcCXbZLbZ7TkCJM6kdq", { domain: 'astar', label: '', token: 'ASTR' })
// 500 when querying rewards verifyAssetHubPortfolioChange("13b6hRRYPHTxFzs9prvL2YGHQepvd4YhdDb9Tc7khySp3hMN", { domain: 'astar', label: '', token: 'ASTR' })
// error !? verifyAssetHubPortfolioChange("15TKmiwx1dG2qiDhi9k18wELcVLUhMw7Fwpdz3jLKBLsYJZ2", { domain: 'astar', label: '', token: 'ASTR' })

// PEAQ -> issue with cross chain transfers -> DAI -> DAI.wh. xcm messages ignored for now
// OK ! verifyAssetHubPortfolioChange("1333RgL47QYYkmJk1BHzfEF4hRE7Bd2Yf8P2HdV8Cn3p9hVh", { domain: 'peaq', label: '', token: 'PEAQ' })
// OK ! verifyAssetHubPortfolioChange("1228xdwBttfQ5LpT2rihE2FLJLAY2hu8jsGYzD2dgY25DkTe", { domain: 'peaq', label: '', token: 'PEAQ' })
// OK ! verifyAssetHubPortfolioChange("12nJnQhAZ5p6xHFNMLTUZ4SyYiSQX5vrz2hdEiVGg4m4FG6i", { domain: 'peaq', label: '', token: 'PEAQ' })
// OK ! verifyAssetHubPortfolioChange("14ztyLQdP2B5ahuH9AipKSqvf29wXSf7jWhJ9mEP8cJXfmVw", { domain: 'peaq', label: '', token: 'PEAQ' })

// MYHTOS
// OK !! verifyAssetHubPortfolioChange("0xf8683ecADdCb12891867CCDF4dbC96f47d62d67B", { domain: 'mythos', label: '', token: 'MYTH' })
// OK !! verifyAssetHubPortfolioChange("0x56F17ebFe6B126E9f196e7a87f74e9f026a27A1F", { domain: 'mythos', label: '', token: 'MYTH' })
// OK !! verifyAssetHubPortfolioChange("0xfd56a122ec50912811ec2856e6df5fd0a1581df2", { domain: 'mythos', label: '', token: 'MYTH' })
// OK !! verifyAssetHubPortfolioChange("0x5EE06FECF52b12c66b03700821FbBc9dD5680361", { domain: 'mythos', label: '', token: 'MYTH' })
// OK !! verifyAssetHubPortfolioChange("0xf7A1F5AC6D7A8Ee94B69fE0BFb092AA36d9a7099", { domain: 'mythos', label: '', token: 'MYTH' })
// OK !! verifyAssetHubPortfolioChange("0xF6eAAdC72D1a58F735965EA196E4FA7029fC76dC", { domain: 'mythos', label: '', token: 'MYTH' })

