import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import {
  MultiLocation,
  XcmTransfer,
} from "../../../blockchain/substrate/model/xcm-transfer";
import { Label } from "../../model/portfolio-movement";

export type EventDerivedAssetMovement = {
  event: EventDetails;
  from?: string;
  to?: string;
  rawAmount: string;
  token?: { symbol: string; decimals: number; unique_id?: string };
  tokenMultiLocation?: MultiLocation;
  xcm?: XcmTransfer;
  label?: Label;
};
