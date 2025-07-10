import { expect, it, describe, jest, beforeEach } from "@jest/globals";
import { JobsService } from "./jobs.service";
import { AwilixContainer } from "awilix";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { Job } from "../../model/job";
import { JobManager } from "./job.manager";

jest.mock("../data-aggregation/helper/is-evm-address", () => ({
  isEvmAddress: jest.fn().mockReturnValue(false),
}));
jest.mock("./get-beginning-last-year", () => ({
  getBeginningLastYear: jest.fn(() => 1609459200000), // Jan 1, 2021 UTC timestamp
}));

const mockJobsService = {
  fetchJobs: jest.fn<any>(),
  addJob: jest.fn<any>(),
  delete: jest.fn<any>(),
  pendingJobs$: {
    pipe: jest.fn<any>(),
  },
};

const mockDIContainer = {
  resolve: jest.fn<any>(),
};

const makeJob = (overrides: Partial<Job> = {}): Job =>
  ({
    wallet: "wallet1",
    blockchain: "polkadot",
    currency: "USD",
    status: "done",
    lastModified: Date.now(),
    syncedUntil: undefined,
    data: undefined,
    ...overrides,
  }) as any;

describe("JobManager.enqueue", () => {
  let jobManager: JobManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jobManager = new JobManager(
      mockJobsService as unknown as JobsService,
      mockDIContainer as unknown as AwilixContainer,
    );
  });

  it("should add new jobs if no matching job exists", async () => {
    mockJobsService.fetchJobs.mockResolvedValue([]);
    mockJobsService.addJob.mockImplementation(
      async (reqId, wallet, blockchain) => ({
        reqId: `new-${blockchain}`,
        wallet,
        blockchain,
        currency: "USD",
        status: "new",
        lastModified: Date.now(),
      }),
    );

    const jobs = await jobManager.enqueue("req-1", "wallet1", "USD", [
      "polkadot",
      "kusama",
    ]);

    expect(mockJobsService.addJob).toHaveBeenCalledTimes(2);
    expect(jobs.every((j) => j.reqId.startsWith("new-"))).toBe(true);
  });

  it("should reuse existing job if not outdated or error", async () => {
    const existingJob = makeJob({
      blockchain: "polkadot",
      status: "done",
      lastModified: Date.now(),
    });
    mockJobsService.fetchJobs.mockResolvedValue([existingJob]);

    const jobs = await jobManager.enqueue("req-2", "wallet1", "USD", [
      "polkadot",
    ]);

    expect(mockJobsService.addJob).not.toHaveBeenCalled();
    expect(jobs).toContain(existingJob);
  });

  it("should delete and add new job if existing job status is error", async () => {
    const errorJob = makeJob({ blockchain: "polkadot", status: "error" });
    mockJobsService.fetchJobs.mockResolvedValue([errorJob]);
    mockJobsService.addJob.mockResolvedValue({
      reqId: "new-job",
      wallet: "wallet1",
      blockchain: "polkadot",
      currency: "USD",
      status: "new",
      lastModified: Date.now(),
    });

    const jobs = await jobManager.enqueue("req-3", "wallet1", "USD", [
      "polkadot",
    ]);

    expect(mockJobsService.delete).toHaveBeenCalledWith(errorJob);
    expect(mockJobsService.addJob).toHaveBeenCalled();
    expect(jobs[0].reqId).toBe("new-job");
  });

  it("should delete and add new job if job is outdated but data reusable", async () => {
    const outdatedJob = makeJob({
      blockchain: "polkadot",
      status: "done",
      lastModified: Date.now() - 2 * 24 * 60 * 60 * 1000, // outdated by 2 days
      syncedUntil: 1609545600000, // Jan 2, 2021
      data: { some: "data" },
    });
    mockJobsService.fetchJobs.mockResolvedValue([outdatedJob]);
    mockJobsService.addJob.mockResolvedValue({
      reqId: "new-job",
      wallet: "wallet1",
      blockchain: "polkadot",
      currency: "USD",
      status: "new",
      lastModified: Date.now(),
      data: outdatedJob.data,
    });

    const jobs = await jobManager.enqueue("req-4", "wallet1", "USD", [
      "polkadot",
    ]);

    expect(mockJobsService.delete).toHaveBeenCalledWith(outdatedJob);
    expect(mockJobsService.addJob).toHaveBeenCalledWith(
      expect.any(String),
      outdatedJob.wallet,
      outdatedJob.blockchain,
      outdatedJob.syncedUntil! - 24 * 60 * 60 * 1000,
      outdatedJob.currency,
      outdatedJob.data,
    );
    expect(jobs[0].reqId).toBe("new-job");
  });
});
