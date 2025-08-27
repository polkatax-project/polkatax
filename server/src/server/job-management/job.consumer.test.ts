import { JobsService } from "./jobs.service";
import { PortfolioMovementsService } from "../data-aggregation/services/portfolio-movements.service";
import { PortfolioChangeValidationService } from "../data-aggregation/services/portfolio-change-validation.service";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { JobConsumer } from "./job.consumer";

jest.mock("../logger/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("JobConsumer", () => {
  let jobsService: jest.Mocked<JobsService>;
  let portfolioMovementsService: jest.Mocked<PortfolioMovementsService>;
  let portfolioChangeValidationService: jest.Mocked<PortfolioChangeValidationService>;
  let consumer: JobConsumer;

  const mockJob = {
    blockchain: subscanChains.chains[0].domain,
    wallet: "0x123",
    currency: "USD",
    syncFromDate: Date.now() - 1000,
    data: { values: [{ timestamp: Date.now() - 2000, balance: 10 }] },
  } as any;

  beforeEach(() => {
    jobsService = {
      setError: jest.fn(),
      setInProgress: jest.fn(),
      setDone: jest.fn(),
    } as any;

    portfolioMovementsService = {
      fetchPortfolioMovements: jest.fn<any>(),
    } as any;

    portfolioChangeValidationService = {
      calculateDeviationFromExpectation: jest.fn<any>(),
    } as any;

    consumer = new JobConsumer(
      jobsService,
      portfolioMovementsService,
      portfolioChangeValidationService,
    );
  });

  it("should set error if chain not found", async () => {
    const badJob = { ...mockJob, blockchain: "unknownChain" };
    await consumer.process(badJob as any);
    expect(jobsService.setError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 400 }),
      badJob,
    );
  });

  it("should exit if job already claimed", async () => {
    jobsService.setInProgress.mockResolvedValue(false);
    await consumer.process(mockJob);
    expect(jobsService.setDone).not.toHaveBeenCalled();
  });

  it("should handle fetch errors with setError", async () => {
    jobsService.setInProgress.mockResolvedValue(true);
    portfolioMovementsService.fetchPortfolioMovements.mockRejectedValue(
      new Error("fetch failed"),
    );

    await consumer.process(mockJob);

    expect(jobsService.setError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 500 }),
      expect.any(Object),
    );
  });
});
