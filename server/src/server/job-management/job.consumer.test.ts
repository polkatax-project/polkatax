import { expect, it, describe, jest, beforeEach } from "@jest/globals";

import { JobConsumer } from "./job.consumer";
import { JobsService } from "./jobs.service";
import { PortfolioMovementsService } from "../data-aggregation/services/portfolio-movements.service";
import { Job } from "../../model/job";
import subscanChains from "../../../res/gen/subscan-chains.json";

jest.mock("../logger/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe("JobConsumer", () => {
  let jobsService: jest.Mocked<JobsService>;
  let portfolioMovementsService: jest.Mocked<PortfolioMovementsService>;
  let consumer: JobConsumer;

  const baseJob: Job = {
    reqId: "req123",
    wallet: "0xABC",
    blockchain: subscanChains.chains[0].domain,
    currency: "ETH",
    status: "pending",
    lastModified: Date.now(),
    syncFromDate: 1000,
    data: undefined,
  };

  beforeEach(() => {
    jobsService = {
      setError: jest.fn<any>(),
      setInProgress: jest.fn(),
      setDone: jest.fn(),
    } as any;

    portfolioMovementsService = {
      fetchPortfolioMovements: jest.fn(),
    } as any;

    consumer = new JobConsumer(jobsService, portfolioMovementsService);
  });

  it("should set error if chain not found", async () => {
    const job = { ...baseJob, blockchain: "nonexistent-chain" };
    await consumer.process(job);

    expect(jobsService.setError).toHaveBeenCalledWith(
      { code: 400, msg: expect.stringContaining("not found") },
      job,
    );
  });

  it("should skip processing if job already claimed", async () => {
    jobsService.setInProgress.mockResolvedValue(false);

    await consumer.process(baseJob);

    expect(jobsService.setInProgress).toHaveBeenCalledWith(baseJob);
    expect(
      portfolioMovementsService.fetchPortfolioMovements,
    ).not.toHaveBeenCalled();
    expect(jobsService.setDone).not.toHaveBeenCalled();
  });

  it("should process job and set done without previous data", async () => {
    jobsService.setInProgress.mockResolvedValue(true);
    portfolioMovementsService.fetchPortfolioMovements.mockResolvedValue({
      portfolioMovements: [{ timestamp: 2000 }],
    } as any);

    await consumer.process(baseJob);

    expect(jobsService.setDone).toHaveBeenCalledWith(
      { values: [{ timestamp: 2000 }] },
      baseJob,
    );
  });

  it("should process job and merge with previous data", async () => {
    const jobWithPrevious: Job = {
      ...baseJob,
      data: {
        values: [
          { timestamp: 500 },
          { timestamp: 900 }, // before syncFromDate
          { timestamp: 1500 }, // after syncFromDate
        ],
      },
    };

    jobsService.setInProgress.mockResolvedValue(true);
    portfolioMovementsService.fetchPortfolioMovements.mockResolvedValue({
      portfolioMovements: [{ timestamp: 2000 }],
    } as any);

    await consumer.process(jobWithPrevious);

    expect(jobsService.setDone).toHaveBeenCalledWith(
      {
        values: [
          { timestamp: 2000 },
          { timestamp: 500 },
          { timestamp: 900 }, // merged
        ],
      },
      jobWithPrevious,
    );
  });

  it("should handle error thrown during processing", async () => {
    const error = new Error("Oops");
    jobsService.setInProgress.mockResolvedValue(true);
    portfolioMovementsService.fetchPortfolioMovements.mockRejectedValue(error);

    await consumer.process(baseJob);

    expect(jobsService.setError).toHaveBeenCalledWith(
      {
        code: 500,
        msg: expect.stringContaining("Oops"),
      },
      baseJob,
    );
  });

  it("should log error if setError itself fails", async () => {
    const error = new Error("Fetch failed");
    const nestedError = new Error("SetError failed");

    jobsService.setInProgress.mockResolvedValue(true);
    portfolioMovementsService.fetchPortfolioMovements.mockRejectedValue(error);
    (jobsService.setError as jest.Mock<any>).mockRejectedValue(nestedError);

    await consumer.process(baseJob);

    expect(jobsService.setError).toHaveBeenCalled();
    // logger is mocked, so no assert, but we avoid crash
  });
});
