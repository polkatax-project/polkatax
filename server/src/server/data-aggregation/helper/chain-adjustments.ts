import { PortfolioMovement } from "../model/portfolio-movement";

export class ChainAdjustments {
  handleAdjustments(domain: string, swaps: PortfolioMovement[]) {
    if (
      domain === "hydration" ||
      domain === "basilisk"
    ) {
      this.handleHydration(swaps);
    }
  }

  handleHydration(swaps: PortfolioMovement[]) {
    swaps.forEach((s) => {
      if (s.transfers.length > 2) {
        const sold = s.transfers
          .filter((transfer) => transfer.amount < 0)
          .map((t) => t.symbol);
        const bought = s.transfers
          .filter((transfer) => transfer.amount > 0)
          .map((t) => t.symbol);
        for (const poolToken of ["2-pool", "4-pool"]) {
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
  }
}
