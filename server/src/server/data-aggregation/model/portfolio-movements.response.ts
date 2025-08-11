import { SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { TaxableEvent } from "./portfolio-movement";

export interface PortfolioMovementsResponse {
  portfolioMovements: TaxableEvent[];
  unmatchedEvents: SubscanEvent[];
}
