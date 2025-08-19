import { Label } from "../../../../common/model/label";
import { SubscanEvent } from "../../../blockchain/substrate/model/subscan-event";
import { XcmTransfer } from "../../../blockchain/substrate/model/xcm-transfer";
import { AssetInfos } from "./asset-infos";

export type EventHandlerContext = AssetInfos & { events: SubscanEvent[] } & {
  xcmList: XcmTransfer[];
  label?: Label;
  chainInfo: { domain: string; token: string };
};
