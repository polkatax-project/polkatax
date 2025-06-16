import { encodeAddress } from "@polkadot/util-crypto";
import { logger } from "../../../logger/logger";

export function mapPublicKeyToAddress(key: string) {
  try {
    const GENERIC_SUBSTRATE_PREFIX = 42;
    return encodeAddress(key, GENERIC_SUBSTRATE_PREFIX);
  } catch (e) {
    logger.error(`Error converting public key ${key} to address`);
    return undefined;
  }
}
