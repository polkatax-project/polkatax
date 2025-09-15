import { convertToCanonicalAddress } from "../../../../common/util/convert-to-canonical-address";
import { MultiLocation } from "../../../blockchain/substrate/model/multi-location";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { TransactionDetails } from "../../../blockchain/substrate/model/transaction";
import { getPropertyValue, mapKeyToCanonicalAddress } from "./helper";

const extractAccountId = (multiLocation: MultiLocation) => {
  const id =
    multiLocation.interior?.X1?.[0]?.AccountId32?.id ||
    multiLocation.interior?.X1?.AccountId32?.id;
  const adr = mapKeyToCanonicalAddress(id);
  return adr;
};

export const extractXcmFees = (
  address: string,
  tx: TransactionDetails,
): number => {
  const getFees = (e: EventDetails) => {
    return Number(
      getPropertyValue("fees", e)?.[0]?.fun?.Fungible ??
        getPropertyValue("fees", e)?.fun?.Fungible,
    );
  };

  const xcmPalletFeesPaidEv = tx.event.filter(
    (e) =>
      e.module_id === "xcmpallet" &&
      e.event_id === "FeesPaid" &&
      extractAccountId(getPropertyValue("paying", e)) === address,
  );
  if (xcmPalletFeesPaidEv.length > 0) {
    return xcmPalletFeesPaidEv.reduce((curr, e) => getFees(e) + curr, 0);
  }
  const polkadotxcmFeesPaidEv = tx.event.filter(
    (e) =>
      e.module_id === "polkadotxcm" &&
      e.event_id === "FeesPaid" &&
      extractAccountId(getPropertyValue("paying", e)) === address,
  );
  if (polkadotxcmFeesPaidEv.length > 0) {
    return polkadotxcmFeesPaidEv.reduce((curr, e) => getFees(e) + curr, 0);
  }
  const xtokensTransferredAssetsEv = tx.event.filter(
    (e) =>
      e.module_id === "xtokens" &&
      e.event_id === "TransferredAssets" &&
      convertToCanonicalAddress(getPropertyValue("sender", e)) === address,
  );
  if (xtokensTransferredAssetsEv.length > 0) {
    return xtokensTransferredAssetsEv.reduce(
      (curr, e) => Number(getPropertyValue("fee", e)?.fun?.Fungible) + curr,
      0,
    );
  }
  return 0;
};
