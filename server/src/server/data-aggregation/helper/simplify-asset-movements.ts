import {
  PortfolioMovement,
  TaxableEventTransfer,
} from "../model/portfolio-movement";

export const simplifyAssetMovementsSemanticId = (
  address: string,
  taxableEvents: PortfolioMovement[],
) => {
  taxableEvents.forEach((taxEvent) => {
    if (taxEvent.transfers.length > 1) {
      const transfers: Record<
        string,
        Record<string, TaxableEventTransfer>
      > = {};
      taxEvent.transfers
        .filter((t) => t.amount !== 0)
        .forEach((t: TaxableEventTransfer) => {
          const semanticGroup = t.semanticGroupId ?? "unknown";
          transfers[semanticGroup] = transfers[semanticGroup] ?? {};
          if (!transfers[semanticGroup][t.asset_unique_id]) {
            transfers[semanticGroup][t.asset_unique_id] = { ...t };
          } else {
            transfers[semanticGroup][t.asset_unique_id].amount += t.amount;
            transfers[semanticGroup][t.asset_unique_id].price =
              transfers[semanticGroup][t.asset_unique_id].price ?? t.price;
          }
        });
      Object.values(transfers).forEach((semanticGroup) =>
        Object.values(semanticGroup).forEach((t) => {
          const otherAddress = t.from === address ? t.to : t.from;
          t.from = t.amount > 0 ? otherAddress : address;
          t.to = t.amount > 0 ? address : otherAddress;
        }),
      );
      taxEvent.transfers = Object.values(transfers)
        .map((semanticGroup) => Object.values(semanticGroup))
        .flat();
    }
    taxEvent.transfers = taxEvent.transfers
      .filter((transfer) => transfer.amount !== 0)
      .map((transfer) => ({
        ...transfer,
        events: undefined,
        fiatValue: transfer.price
          ? Math.abs(transfer.price * transfer.amount)
          : undefined,
      }));
  });
  return taxableEvents;
};
