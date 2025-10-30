export interface BalanceEvent {
  balanceMovementType: "WITHDRAW" | "DEPOSIT";
  blockNumber: number;
  eventId: string;
  amount: number;
  blockTimestamp: string;
  extrinsicId: string;
  extrinsicCallName: string;
  genericStashAccountFrom: string;
  genericStashAccountTo: string;
}
