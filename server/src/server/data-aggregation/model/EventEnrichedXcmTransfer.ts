import { XcmTransfer } from "../../blockchain/substrate/model/xcm-transfer";

export interface EventEnrichedXcmTransfer extends XcmTransfer {
  events: { eventId: string; moduleId: string; eventIndex: string }[];
}
