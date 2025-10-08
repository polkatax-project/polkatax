import { Label } from "../../../common/model/label";
import { Transfer } from "../../blockchain/substrate/model/raw-transfer";

export interface EventDerivedTransfer extends Transfer {
  event_id: string;
  module_id: string;
  original_event_index: string;
  fromChain?: string;
  destChain?: string;
  xcmMessageHash?: string;
  label?: Label;
  semanticGroupId?: string;
}
