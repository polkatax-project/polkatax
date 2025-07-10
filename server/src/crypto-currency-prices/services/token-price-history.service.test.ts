import { expect, it, jest, describe, beforeEach } from "@jest/globals";
import { TokenPriceHistoryService } from "./token-price-history.service";
import { CoingeckoRestService } from "../coingecko-api/coingecko.rest-service";
import { logger } from "../logger/logger";

jest.mock("../logger/logger");

describe("TokenPriceHistoryService", () => {
  let coingeckoRestService: jest.Mocked<CoingeckoRestService>;
  let service: TokenPriceHistoryService;

  beforeEach(() => {
    coingeckoRestService = {
      fetchHistoricalData: jest.fn(),
    } as any;

    service = new TokenPriceHistoryService(coingeckoRestService);

    jest.clearAllMocks();
  });

  it("fetches fresh data when cache is empty", async () => {
    const id = "bitcoin";
    const currency = "usd";
    const dummyQuotes = { "2025-06-28": 50000 };

    coingeckoRestService.fetchHistoricalData.mockResolvedValue(
      dummyQuotes as any,
    );

    const result = await service.getHistoricPrices(id, currency);

    expect(logger.info).toHaveBeenCalledWith(
      `Entry fetchQuotesForId for ${id} in ${currency}`,
    );
    expect(coingeckoRestService.fetchHistoricalData).toHaveBeenCalledWith(
      id,
      currency,
    );
    expect(result).toEqual({ quotes: dummyQuotes, currency });
    expect(logger.info).toHaveBeenCalledWith(
      `Exit fetchQuotesForId for ${id} in ${currency}`,
    );
  });

  it("returns cached data if up-to-date", async () => {
    const id = "ethereum";
    const currency = "eur";
    const combinedKey = `${id}_${currency}`;

    // Prepare cached data for yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formattedYesterday = yesterday.toISOString().slice(0, 10);

    const cachedQuotes = { [formattedYesterday]: 3000, "2025-06-26": 2900 };
    // Set cache directly on the service instance
    (service as any).cachedPrices = { [combinedKey]: cachedQuotes };

    const result = await service.getHistoricPrices(id, currency);

    expect(logger.info).toHaveBeenCalledWith(
      `Entry fetchQuotesForId for ${id} in ${currency}`,
    );
    expect(logger.info).toHaveBeenCalledWith(
      `Exit fetchQuotesForId for ${id} in ${currency}. Returning cached data.`,
    );
    expect(coingeckoRestService.fetchHistoricalData).not.toHaveBeenCalled();
    expect(result).toEqual({ quotes: cachedQuotes, currency });
  });

  it("defaults to 'usd' currency if none provided", async () => {
    const id = "dogecoin";
    const dummyQuotes = { "2025-06-28": 0.1 };

    coingeckoRestService.fetchHistoricalData.mockResolvedValue(
      dummyQuotes as any,
    );

    const result = await service.getHistoricPrices(id);

    expect(coingeckoRestService.fetchHistoricalData).toHaveBeenCalledWith(
      id,
      "usd",
    );
    expect(result).toEqual({ quotes: dummyQuotes, currency: "usd" });
  });
});
