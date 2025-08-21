import {
  expect,
  it,
  describe,
  jest,
  beforeEach,
  afterEach,
  test,
} from "@jest/globals";

import { JobsService } from "./jobs.service";
import { JobRepository } from "./job.repository";
import { Job, JobId } from "../../model/job";
import { WsError } from "../model/ws-error";
import { of, Subject } from "rxjs";

describe("JobsService", () => {
  let service: JobsService;
  let jobRepository: jest.Mocked<JobRepository>;

  const sampleJob: Job = {
    reqId: "123",
    wallet: "wallet1",
    blockchain: "eth",
    status: "pending",
    lastModified: Date.now(),
    currency: "ETH",
    syncFromDate: Date.now(),
    data: { test: "data" },
  };

  beforeEach(() => {
    jobRepository = {
      pendingJobsChanged$: new Subject<void>(),
      fetchAllPendingJobs: jest.fn(),
      insertJob: jest.fn(),
      deleteJob: jest.fn(),
      findJob: jest.fn(),
      setInProgress: jest.fn(),
      setDone: jest.fn(),
      setError: jest.fn(),
      findJobysByWallet: jest.fn(),
    } as any;

    service = new JobsService(jobRepository);
  });

  describe("pendingJobs$", () => {
    it("should fetch and emit pending jobs when changed", (done) => {
      const jobs: Job[] = [sampleJob];
      jobRepository.fetchAllPendingJobs.mockResolvedValue(jobs);

      service.pendingJobs$.subscribe((result) => {
        expect(result).toEqual(jobs);
        done();
      });

      (jobRepository.pendingJobsChanged$ as Subject<void>).next();
    });
  });

  describe("addJob", () => {
    it("should insert a new job and return it", async () => {
      jobRepository.insertJob.mockResolvedValue(undefined);

      const job = await service.addJob(
        "req123",
        "wallet1",
        "eth",
        1234567890,
        "ETH",
        { foo: "bar" },
      );

      expect(jobRepository.insertJob).toHaveBeenCalledWith(
        expect.objectContaining({
          reqId: "req123",
          wallet: "wallet1",
          blockchain: "eth",
          currency: "ETH",
          syncFromDate: 1234567890,
          data: { foo: "bar" },
          status: "pending",
        }),
      );

      expect(job.reqId).toBe("req123");
    });
  });

  describe("delete", () => {
    it("should call deleteJob with the given job", () => {
      service.delete(sampleJob);
      expect(jobRepository.deleteJob).toHaveBeenCalledWith(sampleJob);
    });
  });

  describe("fetchJob", () => {
    it("should return a job from repository", async () => {
      jobRepository.findJob.mockResolvedValue(sampleJob);

      const result = await service.fetchJob("wallet1", "eth", "ETH");

      expect(result).toEqual(sampleJob);
      expect(jobRepository.findJob).toHaveBeenCalledWith({
        wallet: "wallet1",
        blockchain: "eth",
        currency: "ETH",
      });
    });
  });

  describe("setInProgress", () => {
    it("should return true if any job was set in progress", async () => {
      jobRepository.setInProgress.mockResolvedValue([sampleJob]);

      const result = await service.setInProgress("job-id" as any);
      expect(result).toBe(true);
    });

    it("should return false if no job was set in progress", async () => {
      jobRepository.setInProgress.mockResolvedValue([]);

      const result = await service.setInProgress("job-id" as any);
      expect(result).toBe(false);
    });
  });

  describe("setDone", () => {
    it("should call setDone with correct syncedUntil timestamp", async () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(now);

      await service.setDone({ result: "ok" }, "job-id" as any, 123);

      expect(jobRepository.setDone).toHaveBeenCalledWith(
        "job-id",
        { result: "ok" },
        123,
      );
    });
  });

  describe("setError", () => {
    it("should call setError on the repository", () => {
      const error: WsError = { code: 404, msg: "Something went wrong" };
      service.setError(error, "job-id" as any);

      expect(jobRepository.setError).toHaveBeenCalledWith("job-id", error);
    });
  });

  describe("fetchJobs", () => {
    it("should return jobs from repository by wallet", async () => {
      jobRepository.findJobysByWallet.mockResolvedValue([sampleJob]);

      const jobs = await service.fetchJobs("wallet1");
      expect(jobs).toEqual([sampleJob]);
      expect(jobRepository.findJobysByWallet).toHaveBeenCalledWith("wallet1");
    });
  });
});
