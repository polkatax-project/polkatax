import {
  beforeEach,
  describe,
  expect,
  jest,
  afterEach,
  it,
} from "@jest/globals";
import { ExchangeRateRestService } from "../exchange-rate-api/exchange-rate.rest-service";
import { logger } from "../logger/logger";
import { FiatExchangeRateService } from "./fiat-exchange-rate.service";

jest.mock("../logger/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe("FiatExchangeRateService", () => {
  let service: FiatExchangeRateService;
  let mockRestService: jest.Mocked<ExchangeRateRestService>;

  beforeEach(() => {
    mockRestService = {
      fetchTimeSeries: jest.fn(),
    } as any;

    service = new FiatExchangeRateService(mockRestService);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("calls sync() once on init", async () => {
    mockRestService.fetchTimeSeries.mockResolvedValue({ USD: 1.2 } as any);

    await service.init();

    expect(mockRestService.fetchTimeSeries).toHaveBeenCalledTimes(2); // current and previous year
  });

  it("sets interval to call sync every 12 hours", async () => {
    mockRestService.fetchTimeSeries.mockResolvedValue({ USD: 1.2 } as any);

    await service.init();

    jest.advanceTimersByTime(12 * 60 * 60 * 1000); // 12 hours
    expect(mockRestService.fetchTimeSeries).toHaveBeenCalledTimes(3);
  });

  it("aggregates results from multiple years", async () => {
    mockRestService.fetchTimeSeries
      .mockResolvedValueOnce({ USD: 1.2 } as any) // current year
      .mockResolvedValueOnce({ EUR: 0.9 } as any); // last year

    await service["sync"]();

    expect(service.exchangeRates).toEqual({
      USD: 1.2,
      EUR: 0.9,
    });
  });

  it("returns correct date for getEndDate()", () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const futureYear = currentYear + 1;
    const pastYear = currentYear - 1;

    // Should return formatted now
    const nowResult = service["getEndDate"](futureYear);
    expect(nowResult).toBeTruthy(); // just basic check

    // Should return "YYYY-12-31"
    const pastResult = service["getEndDate"](pastYear);
    expect(pastResult).toEqual(`${pastYear}-12-31`);
  });
});
