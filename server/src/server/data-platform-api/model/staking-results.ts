export interface StakingResults {
  chainType: string;
  stakingResults: [
    {
      stakingResultType: string;
      executionDate: string;
      totalAmount: number;
    },
  ];
  nominationPoolResults: [
    {
      stakingResultType: string;
      executionDate: string;
      totalAmount: number;
    },
  ];
}
