export interface ChainSlashes {
  chainType: string;
  stakingSlashingResults: [
    {
      executionDate: string;
      totalAmount: number;
    },
  ];
  balanceSlashingResults: [
    {
      executionDate: string;
      totalAmount: number;
    },
  ];
}
