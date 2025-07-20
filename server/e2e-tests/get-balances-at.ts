import { ApiPromise, WsProvider } from "@polkadot/api";

const endpoints = {
  "assethub-polkadot": "wss://polkadot-asset-hub-rpc.polkadot.io",
  bifrost: "wss://bifrost.public.curie.radiumblock.co/ws",
  polkadot: "wss://polkadot.api.onfinality.io/public-ws",
  kusama: "wss://kusama.api.onfinality.io/public-ws",
  hydration: "wss://hydradx.paras.ibp.network",
  "coretime-polkadot": "wss://coretime-polkadot.dotters.network",
  acala: "wss://acala-rpc.dwellir.com",
  astar: "wss://rpc.astar.network",
  peaq: "wss://peaq.api.onfinality.io/public",
  mythos: "wss://polkadot-mythos-rpc.polkadot.io",
  unique: "wss://unique.ibp.network",
  pendulum: "wss://rpc-pendulum.prd.pendulumchain.tech",
  'collectives-polkadot': "wss://collectives-polkadot-rpc.dwellir.com",
  'people-polkadot': "wss://sys.ibp.network/people-polkadot",
  energywebx: "wss://public-rpc.mainnet.energywebx.com",
  phala: "wss://phala-rpc.dwellir.com",
  neuroweb: "wss://parachain-rpc.origin-trail.network",
  spiritnet: "wss://spiritnet.kilt.io",
  darwinia: "wss://rpc.darwinia.network",
  "alephzero": "wss://aleph-zero.api.onfinality.io/public-ws"
};

export async function creatApi(domain: string) {
  const provider = new WsProvider(endpoints[domain]);
  const api = await ApiPromise.create({ provider });
  return api;
}

export async function getApiAt(api: ApiPromise, blockNumber: number) {
  const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
  const apiAt = (await api.at(blockHash)) as any;
  return apiAt;
}

export async function getNativeTokenBalance(api: ApiPromise, address: string) {
  const accountInfo: any = await api.query.system.account(address);
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

export async function getAssetBalances(
  api: ApiPromise,
  address: string,
  assetIds: number[],
) {
  const tokenBalances = [];
  for (let assetId of assetIds) {
    const balanceInfo: any = await api.query.assets.account(assetId, address);
    tokenBalances.push(balanceInfo.toJSON()?.balance ?? 0);
  }
  console.log(`Balances: ${tokenBalances.join(", ")}`);
  return tokenBalances;
}
