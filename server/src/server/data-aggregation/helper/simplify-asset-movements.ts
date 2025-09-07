import {
  TaxableEvent,
  TaxableEventTransfer,
} from "../model/portfolio-movement";

export const simplifyAssetMovements = (
  address: string,
  taxableEvents: TaxableEvent[],
) => {
  taxableEvents.forEach((t) => {
    if (t.transfers.length > 1) {
      const transfers: Record<string, TaxableEventTransfer> = {};
      t.transfers
        .filter((t) => t.amount !== 0)
        .forEach((t: TaxableEventTransfer) => {
          if (!transfers[t.asset_unique_id ?? t.symbol]) {
            transfers[t.asset_unique_id ?? t.symbol] = t;
          } else {
            transfers[t.asset_unique_id ?? t.symbol].amount += t.amount;
          }
        });
      Object.entries(transfers).forEach(([_, t]) => {
        const otherAddress = t.from === address ? t.to : t.from;
        t.from = t.amount > 0 ? otherAddress : address;
        t.to = t.amount > 0 ? address : otherAddress;
      });
      t.transfers = Object.entries(transfers).map(([_, t]) => t);
    }
  });
  return taxableEvents.filter((t) => t.transfers.length > 0);
};
