export interface StakingResultItem {
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
