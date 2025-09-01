import { PortfolioMovement } from "../model/portfolio-movement";

export class ChainAdjustments {
  handleAdjustments(
    domain: string,
    portfolioMovements: PortfolioMovement[],
  ): PortfolioMovement[] {
    if (domain === "hydration" || domain === "basilisk") {
      return this.handleHydration(portfolioMovements);
    }
    if (domain === "assethub-polkadot" || domain === "assethub-kusama") {
      return this.handleAssetHub(portfolioMovements);
    }
    return portfolioMovements;
  }

  handleHydration(
    portfolioMovements: PortfolioMovement[],
  ): PortfolioMovement[] {
    portfolioMovements.forEach((s) => {
      if (s.transfers.length > 2) {
        const sold = s.transfers
          .filter((transfer) => transfer.amount < 0)
          .map((t) => t.symbol);
        const bought = s.transfers
          .filter((transfer) => transfer.amount > 0)
          .map((t) => t.symbol);
        for (const poolToken of ["2-pool", "4-pool", "2-Pool", "4-Pool"]) {
          if (
            (sold.includes(poolToken) && sold.length > 1) ||
            (bought.includes(poolToken) && bought.length > 1)
          ) {
            s.transfers.splice(
              s.transfers.map((t) => t.symbol).indexOf(poolToken),
              1,
            );
          }
        }
      }
    });
    return portfolioMovements;
  }

  handleAssetHub(portfolioMovements: PortfolioMovement[]): PortfolioMovement[] {
    portfolioMovements.forEach((s) => {
      const xcmTransfers = s.transfers.filter((t) => t.module === "xcm");
      if (xcmTransfers.length > 0) {
        for (let xcmTransfer of xcmTransfers) {
          s.transfers = s.transfers.filter(
            (t) =>
              t.module === "xcm" ||
              t.from !== xcmTransfer.from ||
              t.symbol.toUpperCase() !== xcmTransfer.symbol.toUpperCase(),
          );
        }
      }
    });
    return portfolioMovements;
  }
}
