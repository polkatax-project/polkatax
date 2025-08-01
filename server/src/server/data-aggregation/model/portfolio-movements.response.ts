import { SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { PortfolioMovement } from "./portfolio-movement";

export interface PortfolioMovementsResponse {
  portfolioMovements: PortfolioMovement[];
  unmatchedEvents: SubscanEvent[];
}
