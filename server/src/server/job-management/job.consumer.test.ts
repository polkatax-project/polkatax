import { JobsService } from "./jobs.service";
import { expect, it, describe, jest, beforeEach } from "@jest/globals";
import { StakingRewardsWithFiatService } from "../data-aggregation/services/staking-rewards-with-fiat.service";
import { Job } from "../../model/job";
import { StakingRewardsResponse } from "../data-aggregation/model/staking-rewards.response";
import { JobConsumer } from "./job.consumer";

// Mock dependencies
const mockJobsService = {
  setInProgress: jest.fn<any>(),
  setDone: jest.fn<any>(),
  setError: jest.fn<any>(),
};

const mockStakingService = {
  fetchStakingRewardsViaSubscan: jest.fn<any>(),
};

const createJob = (overrides: Partial<Job> = {}): Job =>
  ({
    wallet: "wallet-abc",
    currency: "USD",
    blockchain: "polkadot",
    syncFromDate: 1700000000,
    reqId: "req-123",
    data: undefined,
    ...overrides,
  }) as any;

describe("JobConsumer", () => {
  let jobConsumer: JobConsumer;

  beforeEach(() => {
    jest.clearAllMocks();
    jobConsumer = new JobConsumer(
      mockJobsService as unknown as JobsService,
      mockStakingService as unknown as StakingRewardsWithFiatService,
    );
  });

  it("should set error if chain is not found", async () => {
    const job = createJob({ blockchain: "non-existent" });

    await jobConsumer.process(job);

    expect(mockJobsService.setError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 400,
        msg: expect.stringContaining("not found"),
      }),
      job,
    );
  });

  it("should return early if setInProgress returns false", async () => {
    const job = createJob();
    mockJobsService.setInProgress.mockResolvedValue(false);

    await jobConsumer.process(job);

    expect(
      mockStakingService.fetchStakingRewardsViaSubscan,
    ).not.toHaveBeenCalled();
    expect(mockJobsService.setDone).not.toHaveBeenCalled();
  });

  it("should process job and set it to done", async () => {
    const job = createJob();
    mockJobsService.setInProgress.mockResolvedValue(true);
    mockStakingService.fetchStakingRewardsViaSubscan.mockResolvedValue({
      values: [{ timestamp: 1800000000 }],
    });

    await jobConsumer.process(job);

    expect(
      mockStakingService.fetchStakingRewardsViaSubscan,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        address: job.wallet,
        currency: job.currency,
        startDate: job.syncFromDate,
      }),
    );
    expect(mockJobsService.setDone).toHaveBeenCalled();
  });

  it("should merge previously synced values if job.data exists", async () => {
    const previousValue = { timestamp: 1600000000 };
    const job = createJob({
      data: { values: [previousValue] } as StakingRewardsResponse,
    });

    mockJobsService.setInProgress.mockResolvedValue(true);
    mockStakingService.fetchStakingRewardsViaSubscan.mockResolvedValue({
      values: [{ timestamp: 1800000000 }],
    });

    await jobConsumer.process(job);

    const result: any = mockJobsService.setDone.mock.calls[0][0];
    expect(result.values).toContainEqual(previousValue);
    expect(result.values.length).toBe(2);
  });

  it("should handle and report processing errors", async () => {
    const job = createJob();
    const error = new Error("Unexpected failure");

    mockJobsService.setInProgress.mockResolvedValue(true);
    mockStakingService.fetchStakingRewardsViaSubscan.mockRejectedValue(error);

    await jobConsumer.process(job);

    expect(mockJobsService.setError).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: expect.stringContaining("Unexpected failure"),
      }),
      job,
    );
  });
});
