import { Label } from "../../../../common/model/label";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { XcmTransfer } from "../../../blockchain/substrate/model/xcm-transfer";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";

export const toTransfer = (
  event: EventDetails,
  from: string,
  to: string,
  amount: number,
  token: { symbol: string; decimals: number; unique_id?: string },
  xcm?: XcmTransfer,
  label?: Label,
): EventDerivedTransfer => {
  if ((to === undefined && from === undefined) || !token || amount === null || amount === undefined) {
    throw `Missing data: to: ${to}, from: ${from}, token: ${JSON.stringify(token)}, amount: ${amount}, event: ${event.original_event_index}, extrinsic: ${event.extrinsic_index}`;
  }
  return {
    event_id: event.event_id,
    module_id: event.module_id,
    original_event_id: event.original_event_index,
    block: event.block_num,
    hash: event.extrinsic_hash,
    extrinsic_index: event.extrinsic_index,
    timestamp: event.timestamp!,
    symbol: token.symbol,
    amount: amount,
    to: to ?? "",
    from: from ?? "",
    asset_unique_id: token.unique_id,
    fromChain: xcm?.transfers[0]?.fromChain,
    destChain: xcm?.transfers[0]?.destChain,
    messageHash: xcm?.messageHash,
    label,
  };
};
