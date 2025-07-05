import { decodeAddress, encodeAddress } from "@polkadot/util-crypto";

export function mapToGenericSubstrateAddress(address: string) {
  try {
    if (isSubstrateAddress(address)) {
      const GENERIC_SUBSTRATE_PREFIX = 0;
      return encodeAddress(decodeAddress(address), GENERIC_SUBSTRATE_PREFIX);
    } else {
      return address
    }
  } catch (e) {
    throw (`Error converting address ${address} to generic adress`);
  }
}

export function isSubstrateAddress(address: string): boolean {
  try {
    decodeAddress(address);
    return true;
  } catch (error) {
    return false; 
  }
}