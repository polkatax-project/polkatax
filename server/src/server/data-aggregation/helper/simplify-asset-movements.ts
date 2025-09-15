import {
  PortfolioMovement,
  TaxableEventTransfer,
} from "../model/portfolio-movement";

const isAlmostZero = (value: number) => {
  return Math.abs(value) < 1e-10;
};

const splitPortfolioMovement = (
  portfolioMovement: PortfolioMovement,
  semanticGroupTransfers: Record<string, Record<string, TaxableEventTransfer>>,
) => {
  const movements = Object.values(semanticGroupTransfers).map((transfers) => {
    return {
      ...portfolioMovement,
      transfers: Object.values(transfers),
      label: Object.values(transfers)[0].label,
      feeUsed: 0,
      feeUsedFiat: 0,
      feeTokenUniqueId: undefined,
    };
  });
  portfolioMovement.transfers = movements[0].transfers;
  portfolioMovement.label = movements[0].label;
  return movements.slice(1);
};

export const simplifyAssetMovementsSemanticId = (
  address: string,
  taxableEvents: PortfolioMovement[],
) => {
  const newPortfolioMovements: PortfolioMovement[] = [];
  taxableEvents.forEach((taxEvent) => {
    if (taxEvent.transfers.length > 1) {
      const transfers: Record<
        string,
        Record<string, TaxableEventTransfer>
      > = {};
      taxEvent.transfers
        .filter((t) => t.amount !== 0)
        .forEach((t: TaxableEventTransfer) => {
          /**
           * semantic grouping is needed exclusively for batch transactions
           */
          const semanticGroup =
            taxEvent.callModule === "utility" &&
            taxEvent.callModuleFunction === "batch_all"
              ? (t.semanticGroupId ?? "none")
              : "none";
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
      if (Object.values(transfers).length > 1) {
        const additionalPortfolioMovements = splitPortfolioMovement(
          taxEvent,
          transfers,
        );
        additionalPortfolioMovements.forEach((p) =>
          newPortfolioMovements.push(p),
        );
      } else {
        taxEvent.transfers = Object.values(transfers).flatMap((semanticGroup) =>
          Object.values(semanticGroup),
        );
      }
    }

    taxEvent.transfers = taxEvent.transfers
      .filter((transfer) => !isAlmostZero(transfer.amount))
      .map((transfer) => ({
        ...transfer,
        events: undefined,
        fiatValue: transfer.price
          ? Math.abs(transfer.price * transfer.amount)
          : undefined,
      }));
  });
  newPortfolioMovements.forEach((p) => taxableEvents.push(p));
  return taxableEvents;
};
