import { ApiPromise, WsProvider } from "@polkadot/api";

const endpoints = {
  "assethub-polkadot": "wss://polkadot-asset-hub-rpc.polkadot.io",
  bifrost: "wss://bifrost.public.curie.radiumblock.co/ws",
  polkadot: "wss://polkadot.api.onfinality.io/public-ws",
  kusama: "wss://kusama.api.onfinality.io/public-ws",
  hydration: "wss://hydradx-rpc.dwellir.com",
  "coretime-polkadot": "wss://coretime-polkadot.dotters.network",
  acala: "wss://acala-rpc.dwellir.com",
  astar: "wss://rpc.astar.network",
  peaq: "wss://peaq.api.onfinality.io/public",
  mythos: "wss://polkadot-mythos-rpc.polkadot.io",
  unique: "wss://unique.ibp.network",
  pendulum: "wss://rpc-pendulum.prd.pendulumchain.tech",
  "collectives-polkadot": "wss://collectives-polkadot-rpc.dwellir.com",
  "people-polkadot": "wss://sys.ibp.network/people-polkadot",
  energywebx: "wss://public-rpc.mainnet.energywebx.com",
  phala: "wss://rpc.helikon.io/phala",
  neuroweb: "wss://parachain-rpc.origin-trail.network",
  spiritnet: "wss://spiritnet.kilt.io",
  darwinia: "wss://rpc.darwinia.network",
  alephzero: "wss://aleph-zero.api.onfinality.io/public-ws",
  manta: "wss://ws.manta.systems",
};

export let api: ApiPromise;
export async function createApi(domain: string) {
  if (api && !(await api.isConnected)) {
    await api.disconnect();
  }
  const provider = new WsProvider(endpoints[domain]);
  api = await ApiPromise.create({ provider, noInitWarn: true });
}

export function getApiClient() {
  return api;
}

export async function getApiAt(blockNumber: number) {
  const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
  const apiAt = (await api.at(blockHash)) as any;
  return apiAt;
}

export async function getNativeTokenBalance(apiAt, address: string) {
  const accountInfo: any = await apiAt.query.system.account(address);
  const json = accountInfo.toJSON();
  const nativeBalance =
    Number(BigInt(json.data.free)) +
    Number(BigInt(json.data?.frozen || 0n)) +
    Number(BigInt(json.data?.reserved ?? 0n));
  return {
    nativeBalance,
    free: Number(BigInt(json.data.free)),
    frozen: Number(BigInt(json.data?.frozen || 0n)),
    reserved: Number(BigInt(json.data?.reserved ?? 0n)),
  };
}
