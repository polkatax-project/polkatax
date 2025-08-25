import { encodeAddress } from "@polkadot/util-crypto";
import { logger } from "../../../logger/logger";

export function mapPublicKeyToAddress(key: string) {
  try {
    const CANONICAL_SUBSTRATE_PREFIX = 0;
    return encodeAddress(
      key.startsWith("0x") ? key : "0x" + key,
      CANONICAL_SUBSTRATE_PREFIX,
    );
  } catch (e) {
    logger.error(`Error converting public key ${key} to address`);
    return undefined;
  }
}
