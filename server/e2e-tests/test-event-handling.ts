import { createDIContainer } from "../src/server/di-container";
import { fetchPayments } from "./fetch-payments";
import { Wallet } from "./wallet";
import { verifyPortfolioHistory } from "./helper/verify-portfolio-history";
import { SubscanService } from "../src/server/blockchain/substrate/api/subscan.service";
import { SubscanApi } from "../src/server/blockchain/substrate/api/subscan.api";


const verifyEventHandling = async (address: string, chain: { domain: string, label: string, token: string }, event_Id: string, tolerance = 0.01) => {
  // fetch events
  const subscanService: SubscanService = createDIContainer().resolve("subscanService")
  const events = await subscanService.searchAllEvents({ chainName: chain.domain, event_id: event_Id, address, minDate: Date.UTC(2024, 0, 1) })
  const eventDetails = await subscanService.fetchEventDetails(chain.domain, events)
  console.log("Found " + eventDetails.length  + " matching events.")

  if (eventDetails.length < 1) {
    throw "No events found"
  }

  const { payments, unmatchedEvents } = await fetchPayments(address, chain);

  for (let event of eventDetails) {
    console.log(`Evaluating event ${JSON.stringify(event, null, 4)}`)
    const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi")
    const block1 = await subscanApi.fetchBlock(chain.domain, event.block_num - 1)
    const block2 = await subscanApi.fetchBlock(chain.domain, event.block_num)
    const blocks = [block1,block2]
    const portfolios = await (new Wallet().fetchPortfolios(chain.domain, chain.token, address, [event.block_num - 1, event.block_num]))
    verifyPortfolioHistory(address, chain.domain, chain.token, portfolios.map(p => ({
      timestamp: blocks[portfolios.indexOf(p)].timestamp, balances: p.values
    })), payments, unmatchedEvents, tolerance)
  }
}


const verifyEventHandlingAssetHub = async (address: string, chain: { domain: string, label: string, token: string }, event_Id: string, tolerance = 0.01) => {
  // fetch events
  const subscanService: SubscanService = createDIContainer().resolve("subscanService")
  const events = await subscanService.searchAllEvents({ chainName: chain.domain, event_id: event_Id, address, minDate: Date.UTC(2024, 0, 1) })
  const eventDetails = await subscanService.fetchEventDetails(chain.domain, events)
  const tokens = await subscanService.scanTokens(chain.domain)
  console.log("Found " + eventDetails.length  + " matching events.")

  //if (eventDetails.length < 1) {
  //  throw "No events found"
  //}

  const { payments, unmatchedEvents } = await fetchPayments(address, chain);

  for (let event of eventDetails) {
    console.log(`Evaluating event ${JSON.stringify(event, null, 4)}`)
    const eventTransfers = await createDIContainer().resolve("specialEventsToTransfersService").handleEvents(chain.domain, [events[events.length - 1]])
    const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi")
    const block1 = await subscanApi.fetchBlock(chain.domain, event.block_num - 1)
    const block2 = await subscanApi.fetchBlock(chain.domain, event.block_num)
    const blocks = [block1,block2]
    const tokensOfInterest = tokens.filter(t => t.symbol === 'USDt' || t.symbol === 'DOT' || t.symbol === 'USDC' || eventTransfers.find(trans => t.symbol === trans.symbol))
    const portfolio1 = await (new Wallet().getAssetBalances(chain.domain, chain.token, address, event.block_num - 1, tokensOfInterest))
    const portfolio2 = await (new Wallet().getAssetBalances(chain.domain, chain.token, address, event.block_num, tokensOfInterest))
    const portfolios = [portfolio1, portfolio2]
    verifyPortfolioHistory(address, chain.domain, chain.token, portfolios.map(p => ({
      timestamp: blocks[portfolios.indexOf(p)].timestamp, balances: p.values
    })), payments, unmatchedEvents, tolerance)
  }
}


verifyEventHandlingAssetHub("13qSxtKtr54qebSQzf1c7MC9CwkkZMMFaXyHKq8LzjSjiU3M", { domain: 'assethub-polkadot', label: '', token: 'DOT' }, 'SwapCreditExecuted')
