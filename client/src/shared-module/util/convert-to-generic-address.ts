import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { isValidSubstrateAddress } from './is-valid-address';

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

export const isCanonicalSubstrateAddress = (address: string): boolean => {
  if (!isValidSubstrateAddress(address)) {
    return false;
  } else {
    const genericAddress = convertToCanonicalAddress(address);
    return address === genericAddress;
  }
};
