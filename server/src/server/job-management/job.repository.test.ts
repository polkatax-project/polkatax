import {
  expect,
  it,
  describe,
  jest,
  beforeEach,
  afterEach,
  test,
} from "@jest/globals";

jest.mock("pg");
jest.mock("../database/db-connection", () => ({
  connectToDb: jest.fn(),
}));
jest.mock("../logger/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { connectToDb } from "../database/db-connection";
import { JobRepository } from "./job.repository";

describe("JobRepository", () => {
  let jobRepo: JobRepository;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      on: jest.fn(),
    };
    (connectToDb as jest.Mock<any>).mockResolvedValue(mockClient);
    jobRepo = new JobRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("init subscribes to notifications", async () => {
    // Wait a tick so init() completes
    await new Promise(setImmediate);

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("LISTEN job_changed"),
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("LISTEN pending_jobs_changed"),
    );
    expect(mockClient.on).toHaveBeenCalledWith(
      "notification",
      expect.any(Function),
    );
  });

  test("mapToJob converts snake_case to camelCase and dates to timestamps", () => {
    const row = {
      wallet: "w1",
      blockchain: "chain1",
      sync_from_date: new Date("2020-01-01"),
      synced_until: new Date("2020-02-01"),
      last_modified: new Date("2020-03-01"),
      currency: "CUR",
      req_id: "req1",
      status: "pending",
    };

    const job = jobRepo.mapToJob(row);

    expect(job.wallet).toBe("w1");
    expect(job.blockchain).toBe("chain1");
    expect(job.syncFromDate).toBe(new Date("2020-01-01").getTime());
    expect(job.syncedUntil).toBe(new Date("2020-02-01").getTime());
    expect(job.lastModified).toBe(new Date("2020-03-01").getTime());
    expect(job.currency).toBe("CUR");
    expect(job.reqId).toBe("req1");
    expect(job.status).toBe("pending");
  });

  test("insertJob runs insert query and notifies pending jobs", async () => {
    mockClient.query.mockResolvedValue({});

    const job = {
      wallet: "w1",
      blockchain: "chain1",
      syncFromDate: Date.now(),
      currency: "CUR",
      reqId: "req1",
    };

    await jobRepo.insertJob(job as any);

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO jobs"),
      expect.any(Array),
    );
  });

  test("findJobysByWallet returns mapped jobs", async () => {
    const dbRows = [
      {
        wallet: "w1",
        blockchain: "chain1",
        currency: "CUR",
        sync_from_date: new Date(),
      },
    ];
    mockClient.query.mockResolvedValue({ rows: dbRows });

    const jobs = await jobRepo.findJobysByWallet("w1");

    expect(mockClient.query).toHaveBeenCalledWith(expect.any(String), ["w1"]);
    expect(jobs.length).toBe(1);
    expect(jobs[0].wallet).toBe("w1");
  });

  test("findJob returns a single job or undefined", async () => {
    const jobId = { wallet: "w1", blockchain: "chain1", currency: "CUR" };
    const dbRows = [
      {
        wallet: "w1",
        blockchain: "chain1",
        currency: "CUR",
        sync_from_date: new Date(),
      },
    ];
    mockClient.query.mockResolvedValue({ rows: dbRows });

    const job = await jobRepo.findJob(jobId);
    expect(job).toBeDefined();

    mockClient.query.mockResolvedValue({ rows: [] });
    const noJob = await jobRepo.findJob(jobId);
    expect(noJob).toBeUndefined();
  });

  test("setInProgress updates job status and triggers notifications", async () => {
    const jobId = { wallet: "w1", blockchain: "chain1", currency: "CUR" };
    const updatedRows = [
      {
        wallet: "w1",
        blockchain: "chain1",
        currency: "CUR",
        status: "in_progress",
      },
    ];
    mockClient.query
      .mockResolvedValueOnce({ rows: updatedRows })
      .mockResolvedValue({});

    const result = await jobRepo.setInProgress(jobId);

    expect(result).toEqual(updatedRows);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE jobs"),
      expect.any(Array),
    );
  });

  test("setError updates job status and triggers jobChanged notification", async () => {
    const jobId = { wallet: "w1", blockchain: "chain1", currency: "CUR" };
    mockClient.query.mockResolvedValue({});

    await jobRepo.setError(jobId, { code: 500, msg: "error" });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE jobs"),
      expect.any(Array),
    );
  });

  test("notify job changed should omit job data", async () => {
    const job = {
      wallet: "w1",
      blockchain: "chain1",
      currency: "CUR",
      data: "LARGE_AMOUNT_OF_DATA",
    };
    mockClient.query.mockResolvedValue({});
    await jobRepo["notifyJobChanged"](job);

    const jobId = {
      ...job,
      data: undefined,
    };
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      `NOTIFY job_changed, '${JSON.stringify(jobId)}';`,
    );
  });

  test("setDone updates job status and triggers jobChanged notification", async () => {
    const jobId = { wallet: "w1", blockchain: "chain1", currency: "CUR" };
    mockClient.query.mockResolvedValue({});

    await jobRepo.setDone(jobId, { some: "data" }, Date.now());

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE jobs"),
      expect.any(Array),
    );
  });

  test("deleteJob calls delete query", async () => {
    const job = { wallet: "w1", blockchain: "chain1", currency: "CUR" };
    mockClient.query.mockResolvedValue({ rows: [] });

    await jobRepo.deleteJob(job as any);

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM jobs"),
      expect.any(Array),
    );
  });
});
