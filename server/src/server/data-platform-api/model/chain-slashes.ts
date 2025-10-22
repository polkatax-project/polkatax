export interface ChainSlashes {
  chainType: string;
  stakingSlashingResults: [
    {
      blockNumber: number;
      blockTimestamp: string;
      eventId: string;
      amount: number;
      executionDate?: string;
      totalAmount?: number;
    },
  ];
  balanceSlashingResults: [
    {
      executionDate: string;
      totalAmount: number;
    },
  ];
}
