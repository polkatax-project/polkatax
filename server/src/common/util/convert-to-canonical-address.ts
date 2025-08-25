import { decodeAddress, encodeAddress } from "@polkadot/util-crypto";
import { isValidEvmAddress, isValidSubstrateAddress } from "./is-valid-address";

export const convertToCanonicalAddress = (address: string): string => {
  if (isValidSubstrateAddress(address) && !isValidEvmAddress(address)) {
    const publicKey = decodeAddress(address);
    /**
     * @see https://polkadot.polkassembly.io/referenda/1217
     */
    return encodeAddress(publicKey, 0);
  } else {
    return address;
  }
};
