import { Asset } from "../../../blockchain/substrate/model/asset";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { XcmTransfer } from "../../../blockchain/substrate/model/xcm-transfer";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";
import { Label } from "../../model/portfolio-movement";
import { extractAddress, findMatchingXcm, getPropertyValue } from "./helper";
import { toTransfer } from "./to-transfer";

export const onBalancesWithdraw = async (
  event: EventDetails,
  {
    tokens,
    xcmList,
    label,
  }: { tokens: Asset[]; xcmList: XcmTransfer[]; label?: Label },
): Promise<EventDerivedTransfer> => {
  const address = extractAddress("who", event);
  const tokenInfo = tokens.find((t) => t.native);
  const amount =
    Number(getPropertyValue("amount", event)) /
    Math.pow(10, tokenInfo?.decimals);
  const xcm = findMatchingXcm(event, xcmList);
  return toTransfer(
    event,
    address,
    "",
    amount,
    tokenInfo,
    xcm,
    (label ?? xcm) ? "XCM transfer" : undefined,
  );
};
