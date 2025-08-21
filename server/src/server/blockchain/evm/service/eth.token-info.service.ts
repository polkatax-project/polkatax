import { firstValueFrom, ReplaySubject, Subject } from "rxjs";
import { logger } from "../../../logger/logger";
import Web3 from "web3";

const web3Eth = new Web3("https://eth-mainnet.public.blastapi.io");
const web3Moonbeam = new Web3("https://rpc.api.moonbeam.network");

const minABI = [
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
];

export class EthTokenInfoService {
  private pendingRequests: Record<string, Subject<any>> = {};

  private cache: Map<string, { symbol: string; decimals: number }> = new Map();

  async fetchTokenInfo(
    chain: "moonbeam" | "ethereum",
    address: string,
  ): Promise<{ symbol: string; decimals: number }> {
    logger.info("Entry: Fetch Token Info for " + address);

    if (
      address.toLocaleLowerCase() ===
      "0x0000000000000000000000000000000000000000"
    ) {
      return { symbol: chain === "ethereum" ? "ETH" : "GLMR", decimals: 18 };
    }

    // Return from cache if available
    const cached = this.cache.get(address.toLowerCase());
    if (cached) {
      logger.info(`Cache hit for token: ${address}`);
      return cached;
    }

    if (this.pendingRequests[chain + address]) {
      return firstValueFrom(this.pendingRequests[chain + address]);
    }
    this.pendingRequests[chain + address] = new ReplaySubject<any>(1);

    // Otherwise, fetch from blockchain
    const web3 = chain === "ethereum" ? web3Eth : web3Moonbeam;
    const contract = new web3.eth.Contract(minABI, address);
    const [symbol, decimals] = await Promise.all([
      contract.methods.symbol().call(),
      contract.methods.decimals().call(),
    ]);

    const tokenInfo = { symbol: symbol as any, decimals: Number(decimals) };

    // Cache it
    this.cache.set(address.toLowerCase(), tokenInfo);

    // notify observers and remove pending request
    if (this.pendingRequests[chain + address]) {
      this.pendingRequests[chain + address].next(tokenInfo);
      delete this.pendingRequests[chain + address];
    }

    logger.info(
      `Fetched and cached token: ${address}. Symbol: ${tokenInfo.symbol}`,
    );
    return tokenInfo;
  }
}
