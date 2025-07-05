import { SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { Payment } from "./payment";

export interface PaymentsResponse {
  payments: Payment[];
  unmatchedEvents: SubscanEvent[]
}
