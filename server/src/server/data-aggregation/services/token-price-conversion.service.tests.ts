import { TokenPriceConversionService } from "./token-price-conversion.service";
import { CryptoCurrencyPricesService } from "./crypto-currency-prices.service";
import { logger } from "../../logger/logger";
import { expect, it, jest, describe, beforeEach } from "@jest/globals";

jest.mock("../../logger/logger");

describe("TokenPriceConversionService", () => {
  let cryptoService: jest.Mocked<CryptoCurrencyPricesService>;
  let service: TokenPriceConversionService;

  beforeEach(() => {
    cryptoService = {
      fetchHistoricalPrices: jest.fn(),
    } as any;

    service = new TokenPriceConversionService(cryptoService);

    // Clear logger mocks
    (logger.info as jest.Mock).mockClear();
    (logger.error as jest.Mock).mockClear();
  });

  it("fetches quotes for all tokens successfully", async () => {
    cryptoService.fetchHistoricalPrices.mockImplementation(
      async (token, currency) => {
        return { price: 100, currency } as any;
      },
    );

    const tokens = ["token1", "token2"];
    const currency = "usd";

    const result = await service.fetchQuotesForTokens(tokens, currency);

    expect(cryptoService.fetchHistoricalPrices).toHaveBeenCalledTimes(2);
    expect(cryptoService.fetchHistoricalPrices).toHaveBeenCalledWith(
      "token1",
      currency,
    );
    expect(cryptoService.fetchHistoricalPrices).toHaveBeenCalledWith(
      "token2",
      currency,
    );

    expect(result).toEqual({
      token1: { price: 100, currency },
      token2: { price: 100, currency },
    });

    expect(logger.info).toHaveBeenCalledWith(
      "Entry fetchQuotesForTokens token1, token2 in usd",
    );
    expect(logger.info).toHaveBeenCalledWith("Exit fetchQuotesForTokens");
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs error and continues when fetchHistoricalPrices throws", async () => {
    cryptoService.fetchHistoricalPrices.mockImplementation(async (token) => {
      if (token === "token2") throw new Error("fail");
      return { price: 50, currency: "usd" } as any;
    });

    const tokens = ["token1", "token2"];
    const currency = "usd";

    const result = await service.fetchQuotesForTokens(tokens, currency);

    expect(result.token1).toEqual({ price: 50, currency: "usd" });
    expect(result.token2).toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to fetch quotes for token token2",
    );
    expect(logger.error).toHaveBeenCalledWith(expect.any(Error));

    expect(logger.info).toHaveBeenCalledWith(
      "Entry fetchQuotesForTokens token1, token2 in usd",
    );
    expect(logger.info).toHaveBeenCalledWith("Exit fetchQuotesForTokens");
  });
});
