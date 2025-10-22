import { SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { PortfolioMovement } from "../model/portfolio-movement";

export const applyTreasuryAwardedAdjustment = (
  portfolioMovements: PortfolioMovement[],
  events: SubscanEvent[],
) => {
  const treasuryAwardedEvents = events.filter(
    (e) => e.module_id === "treasury" && e.event_id === "Awarded",
  );
  treasuryAwardedEvents.forEach((e) => {
    const matchingMovement = portfolioMovements.find(
      (p) => p.timestamp === e.timestamp,
    );
    if (
      matchingMovement &&
      matchingMovement.transfers.length === 2 &&
      matchingMovement.transfers[0].amount ===
        matchingMovement.transfers[1].amount
    ) {
      matchingMovement.transfers = [matchingMovement.transfers[0]];
    }
  });
};
