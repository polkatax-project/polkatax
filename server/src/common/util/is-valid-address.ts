import { decodeAddress } from "@polkadot/util-crypto";
import { getAddress } from "ethers";

export function isValidEvmAddress(addr: string): boolean {
  try {
    getAddress(addr);
    return true;
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

export const isValidWalletAddress = (address: string) => {
  return isValidEvmAddress(address) || isValidSubstrateAddress(address);
};
