import { Asset } from "../../../blockchain/substrate/model/asset";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { XcmTransfer } from "../../../blockchain/substrate/model/xcm-transfer";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";
import { extractAddress, findMatchingXcm, getPropertyValue } from "./helper";
import { toTransfer } from "./to-transfer";

export const onBalancesDeposit = async (
  event: EventDetails,
  { tokens, xcmList }: { tokens: Asset[]; xcmList: XcmTransfer[] },
): Promise<EventDerivedTransfer> => {
  const address = extractAddress("who", event);
  const tokenInfo = tokens.find((t) => t.native);
  const amount =
    Number(getPropertyValue("amount", event)) /
    Math.pow(10, tokenInfo?.decimals);
  return toTransfer(
    event,
    "",
    address,
    amount,
    tokenInfo,
    findMatchingXcm(event, xcmList),
  );
};
