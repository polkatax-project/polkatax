import { Transfer } from "../../blockchain/substrate/model/raw-transfer";
import { Label } from "./portfolio-movement";

export interface EventDerivedTransfer extends Transfer {
  event_id: string;
  module_id: string;
  original_event_id: string;
  fromChain?: string;
  destChain?: string;
  messageHash?: string;
  label?: Label;
}
