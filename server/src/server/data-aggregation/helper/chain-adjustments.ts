import { PortfolioMovement } from "../model/portfolio-movement";

export class ChainAdjustments {
  handleAdjustments(
    domain: string,
    portfolioMovements: PortfolioMovement[],
  ): PortfolioMovement[] {
    if (domain === "hydration" || domain === "basilisk") {
      return this.handleHydration(portfolioMovements);
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

    const movements = portfolioMovements.filter((s) => {
      if ((s?.events ?? []).find(
          (e) =>
            e.moduleId === "staking" &&
            e.eventId === "RewardsClaimed" &&
            process.env["USE_DATA_PLATFORM_API"] === 'true',
        )
      ) {
        return false;
      }
      return true;
    });

    return movements;
  }
}
