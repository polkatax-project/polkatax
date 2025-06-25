import { ApiPromise, WsProvider } from "@polkadot/api";

const endpoints = {
  "assethub-polkadot": "wss://polkadot-asset-hub-rpc.polkadot.io",
  bifrost: "wss://bifrost.public.curie.radiumblock.co/ws",
  polkadot: "wss://polkadot.api.onfinality.io/public-ws",
  kusama: "wss://kusama.api.onfinality.io/public-ws",
  hydration: "wss://hydradx.paras.ibp.network",
  'coretime-polkadot': "wss://coretime-polkadot.dotters.network"
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
  const accountInfo: any = (await api.query.system.account(address))
  const json = accountInfo.toJSON()
  const nativeBalance = Number(BigInt(json.data.free)) + Number(BigInt(json.data?.frozen || 0n)) + Number(BigInt(json.data?.reserved ?? 0n));
  return { nativeBalance, free: Number(BigInt(json.data.free)), frozen: Number(BigInt(json.data?.frozen || 0n)), reserved: Number(BigInt(json.data?.reserved ?? 0n))};
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
