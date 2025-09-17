import {
  PortfolioMovement,
  TaxableEventTransfer,
} from "../model/portfolio-movement";

const isAlmostZero = (value: number) => {
  return Math.abs(value) < 1e-8;
};

const splitPortfolioMovement = (
  portfolioMovement: PortfolioMovement,
  semanticGroupTransfers: Record<string, Record<string, TaxableEventTransfer>>,
) => {
  const movements = Object.values(semanticGroupTransfers)
    .filter((transfers) =>
      Object.values(transfers).some((t) => !isAlmostZero(t.amount)),
    )
    .map((transfersRecord, idx) => {
      const transfers = Object.values(transfersRecord);
      const isXcm = transfers.some(
        (t) => t.label === "XCM transfer" || t.module === "xcm",
      );
      return {
        ...portfolioMovement,
        transfers: transfers,
        feeUsed: idx === 0 ? portfolioMovement.feeUsed : 0,
        feeUsedFiat: idx === 0 ? portfolioMovement.feeUsedFiat : 0,
        feeTokenSymbol:
          idx === 0 ? portfolioMovement.feeTokenSymbol : undefined,
        feeTokenUniqueId:
          idx === 0 ? portfolioMovement.feeTokenUniqueId : undefined,
        xcmFee: isXcm ? portfolioMovement.xcmFee : 0,
        xcmFeeFiat: isXcm ? portfolioMovement.xcmFeeFiat : 0,
        xcmFeeTokenSymbol: isXcm
          ? portfolioMovement.xcmFeeTokenSymbol
          : undefined,
        xcmFeeTokenUniqueId: isXcm
          ? portfolioMovement.xcmFeeTokenUniqueId
          : undefined,
        events: [],
      };
    })
    .filter((p) => !!p);
  return movements;
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
          const semanticGroup = t.semanticGroupId ?? "none";
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
        taxEvent["to_delete"] = true;
      } else {
        taxEvent.transfers = Object.values(transfers).flatMap((semanticGroup) =>
          Object.values(semanticGroup),
        );
      }
    }
  });

  taxableEvents = taxableEvents.filter((t) => !t["to_delete"]);
  newPortfolioMovements.forEach((p) => taxableEvents.push(p));
  taxableEvents.forEach((taxEvent) => {
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

  return taxableEvents;
};
