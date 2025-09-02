export const createJobId = (job: {
  blockchain: string;
  currency: string;
  wallet: string;
  syncFromDate: number;
  syncUntilDate: number;
}): string => {
  return `${job.blockchain}_${job.wallet}_${job.currency}_${job.syncFromDate}_${job.syncUntilDate}`;
};
