import { logger } from "../../../logger/logger";
import Web3 from 'web3'

const web3 = new Web3('https://eth-mainnet.public.blastapi.io');

const minABI = [
  { constant: true, inputs: [], name: 'symbol', outputs: [{ name: '', type: 'string' }], type: 'function' },
  { constant: true, inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], type: 'function' }
];

export class EthTokenInfoService {
  private cache: Map<string, { symbol: string; decimals: number }> = new Map();

  async fetchTokenInfo(address: string): Promise<{ symbol: string; decimals: number }> {
    logger.info('Entry: Fetch Token Info');

    // Return from cache if available
    const cached = this.cache.get(address.toLowerCase());
    if (cached) {
      logger.info(`Cache hit for token: ${address}`);
      return cached;
    }

    // Otherwise, fetch from blockchain
    const contract = new web3.eth.Contract(minABI, address);
    const [symbol, decimals] = await Promise.all([
      contract.methods.symbol().call(),
      contract.methods.decimals().call()
    ]);

    const tokenInfo = { symbol: symbol as any, decimals: Number(decimals) };

    // Cache it
    this.cache.set(address.toLowerCase(), tokenInfo);

    logger.info(`Fetched and cached token: ${address}`, tokenInfo);
    return tokenInfo;
  }
}