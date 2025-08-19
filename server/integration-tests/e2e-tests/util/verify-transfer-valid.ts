import { expect } from "@jest/globals";
import { EventDerivedTransfer } from "../../../src/server/data-aggregation/model/event-derived-transfer";

export const verifyEventTransferIsValid = (t: EventDerivedTransfer) => {
  expect(t.asset_unique_id).not.toBeFalsy();
  expect(t.symbol).not.toBeFalsy();
  expect(t.to || t.from).not.toBeFalsy();
  expect(t.amount).toBeGreaterThan(0);
};

export const verifyEventTransfersAreValid = (
  transfers: EventDerivedTransfer[],
) => {
  transfers.forEach((t) => verifyEventTransferIsValid(t));
};
