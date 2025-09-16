import { Label } from "../../../../common/model/label";
import { MultiLocation } from "../../../blockchain/substrate/model/multi-location";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { XcmTransfer } from "../../../blockchain/substrate/model/xcm-transfer";

export type EventDerivedAssetMovement = {
  event: EventDetails;
  from?: string;
  to?: string;
  rawAmount: string;
  token?: { symbol: string; decimals: number; unique_id?: string };
  tokenMultiLocation?: MultiLocation;
  xcm?: XcmTransfer;
  label?: Label;
  semanticGroupId?: string;
};
