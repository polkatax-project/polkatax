export interface StakingResultsDetailed {
  chainType: string;
  stakingResults: [
    {
      blockNumber: number;
      executionDate: string;
      amount: number;
      blockTimestamp: string;
      extrinsicId: string;
    },
  ];
  nominationPoolResults: [
    {
      blockNumber: number;
      executionDate: string;
      amount: number;
      blockTimestamp: string;
      extrinsicId: string;
    },
  ];
}
