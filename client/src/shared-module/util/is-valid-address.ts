import { decodeAddress } from '@polkadot/util-crypto';
import { getAddress } from 'ethers';

export function isValidEvmAddress(addr: string): boolean {
  try {
    return getAddress(addr) === addr;
  } catch {
    return false;
  }
}

export function isValidSubstrateAddress(addr: string): boolean {
  try {
    decodeAddress(addr);
    return true;
  } catch {
    return false;
  }
}

export const isValidAddress = (address: string) => {
  if (!address) {
    return false;
  }
  return isValidEvmAddress(address) || isValidSubstrateAddress(address);
};
