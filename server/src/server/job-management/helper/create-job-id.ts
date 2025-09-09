export const createJobId = (job: {
  blockchain: string;
  currency: string;
  wallet: string;
  syncFromDate: number;
  syncUntilDate: number;
}): string => {
  return `${job.blockchain}_${job.wallet}_${job.currency}_${job.syncFromDate}_${job.syncUntilDate}`;
};

export const decomposeJobId = (
  jobId: string,
): {
  blockchain: string;
  currency: string;
  wallet: string;
  syncFromDate: number;
  syncUntilDate: number;
} => {
  const parts = jobId.split("_");
  return {
    blockchain: parts[0],
    wallet: parts[1],
    currency: parts[2],
    syncFromDate: Number(parts[3]),
    syncUntilDate: Number(parts[4]),
  };
};
