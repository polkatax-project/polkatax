import { isEvmAddress } from "../../../src/server/data-aggregation/helper/is-evm-address";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import * as substrateNodesWsEndpoints from "../../../res/substrate-nodes-ws-endpoints.json";

export function getVerifyableChains(
  wallet: string,
): { domain: string; token: string }[] {
  const isEvm = isEvmAddress(wallet);
  return subscanChains.chains
    .filter((c) => !c.excluded)
    .filter((c) => Object.keys(substrateNodesWsEndpoints).includes(c.domain))
    .filter((c) => !isEvm || c.evmPallet || c.evmAddressSupport);
}
