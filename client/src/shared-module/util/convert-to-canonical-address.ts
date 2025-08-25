import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { isValidSubstrateAddress } from './is-valid-address';
import { getAddress } from 'ethers';

export const convertToCanonicalAddress = (address: string): string => {
  if (isValidSubstrateAddress(address)) {
    const publicKey = decodeAddress(address);
    /**
     * @see https://polkadot.polkassembly.io/referenda/1217
     */
    return encodeAddress(publicKey, 0);
  } else {
    return address;
  }
};

export function isValidEvmAddress(addr: string): boolean {
  try {
    return getAddress(addr) === addr;
  } catch {
    return false;
  }
}

export const isCanonicalSubstrateAddress = (address: string): boolean => {
  if (!isValidSubstrateAddress(address)) {
    return false;
  } else {
    const canonicalAddress = convertToCanonicalAddress(address);
    return address === canonicalAddress;
  }
};
