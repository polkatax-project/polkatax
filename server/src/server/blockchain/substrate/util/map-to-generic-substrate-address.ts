import { decodeAddress, encodeAddress } from "@polkadot/util-crypto";

export function mapToGenericSubstrateAddress(address: string) {
  try {
    const GENERIC_SUBSTRATE_PREFIX = 42;
    return encodeAddress(decodeAddress(address), GENERIC_SUBSTRATE_PREFIX);
  } catch (e) {
    throw (`Error converting address ${address} to generic adress`);
  }
}
