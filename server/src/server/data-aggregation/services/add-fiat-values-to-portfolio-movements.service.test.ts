import { expect, it, jest, describe, beforeEach } from "@jest/globals";

import { AddFiatValuesToPortfolioMovementsService } from "../services/add-fiat-values-to-portfolio-movements.service";
import { TokenPriceConversionService } from "../services/token-price-conversion.service";
import { FiatExchangeRateService } from "../services/fiat-exchange-rate.service";
import { PortfolioMovement } from "../model/portfolio-movement";
import { findCoingeckoIdForNativeToken } from "../helper/find-coingecko-id-for-native-token";
import { convertFiatValues } from "../helper/convert-fiat-values";

jest.mock("../helper/find-coingecko-id-for-native-token");
jest.mock("../helper/convert-fiat-values");
jest.mock("../../logger/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { logger } from "../../logger/logger";

describe("AddFiatValuesToPortfolioMovementsService", () => {
  let service: AddFiatValuesToPortfolioMovementsService;
  let tokenPriceConversionService: jest.Mocked<TokenPriceConversionService>;
  let fiatExchangeRateService: jest.Mocked<FiatExchangeRateService>;

  beforeEach(() => {
    tokenPriceConversionService = {
      fetchQuotesForTokens: jest.fn(),
    } as any;

    fiatExchangeRateService = {
      fetchExchangeRates: jest.fn(),
    } as any;

    service = new AddFiatValuesToPortfolioMovementsService(
      tokenPriceConversionService,
      fiatExchangeRateService,
    );

    jest.clearAllMocks();
  });

  describe("addFiatValuesForTxFees", () => {
    it("adds fiat fee and tip values when quotes exist for date", () => {
      const portfolioMovements: PortfolioMovement[] = [
        {
          timestamp: Date.UTC(2023, 0, 1), // Jan 1, 2023
          feeUsed: 2,
          tip: 1,
        } as PortfolioMovement,
        {
          timestamp: Date.UTC(2023, 0, 2), // Jan 2, 2023
          feeUsed: 5,
          tip: undefined,
        } as PortfolioMovement,
      ];

      const quotes = {
        currency: "USD",
        quotes: {
          "2023-01-01": 10, // price for Jan 1, 2023
          "2023-01-02": 20,
        },
      };

      const result = service.addFiatValuesForTxFees(
        portfolioMovements,
        quotes as any,
      );

      expect(result[0].feeUsedFiat).toBe(20); // 2 * 10
      expect(result[0].tipFiat).toBe(10); // 1 * 10
      expect(result[1].feeUsedFiat).toBe(100); // 5 * 20
      expect(result[1].tipFiat).toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("logs warning if no quote found for date", () => {
      const portfolioMovements: PortfolioMovement[] = [
        {
          timestamp: Date.UTC(2023, 0, 3),
          feeUsed: 2,
          tip: 1,
        } as PortfolioMovement,
      ];

      const quotes = {
        currency: "USD",
        quotes: {
          "2023-01-01": 10,
        },
      };

      service.addFiatValuesForTxFees(portfolioMovements, quotes as any);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No quote found for USD for date 2023-01-03"),
      );
    });
  });

  describe("addFiatValues", () => {
    const context = {
      address: "someAddress",
      chain: { domain: "polkadot", token: "DOT" },
      currency: "eur",
    };

    it("fetches quotes and exchange rates and calls helpers accordingly", async () => {
      (findCoingeckoIdForNativeToken as jest.Mock).mockReturnValue(
        "polkadot-coingecko-id",
      );

      const portfolioMovements: PortfolioMovement[] = [
        { timestamp: 1 } as PortfolioMovement,
      ];

      const fakeQuotes = {
        "polkadot-coingecko-id": {
          currency: "eur",
          quotes: { "1970-01-01": 5 },
        },
      };
      const fakeExchangeRates = { USD: 1.0 };

      tokenPriceConversionService.fetchQuotesForTokens.mockResolvedValue(
        fakeQuotes as any,
      );
      fiatExchangeRateService.fetchExchangeRates.mockResolvedValue(
        fakeExchangeRates as any,
      );

      await service.addFiatValues(context, portfolioMovements);

      expect(
        tokenPriceConversionService.fetchQuotesForTokens,
      ).toHaveBeenCalledWith(["polkadot-coingecko-id"], "eur");
      expect(fiatExchangeRateService.fetchExchangeRates).toHaveBeenCalled();

      // convertFiatValues called since currency !== 'USD'
      expect(convertFiatValues).toHaveBeenCalledWith(
        "EUR",
        portfolioMovements,
        fakeExchangeRates,
      );

      // addFiatValuesForTxFees should be called internally; spy on it
      // Spy manually because it's an instance method
      const spy = jest.spyOn(service, "addFiatValuesForTxFees");
      await service.addFiatValues(context, portfolioMovements);
      expect(spy).toHaveBeenCalledWith(
        portfolioMovements,
        fakeQuotes["polkadot-coingecko-id"],
      );
      spy.mockRestore();
    });

    it("logs error and does not call addFiatValuesForTxFees if no quotes found", async () => {
      (findCoingeckoIdForNativeToken as jest.Mock).mockReturnValue(
        "polkadot-coingecko-id",
      );

      tokenPriceConversionService.fetchQuotesForTokens.mockResolvedValue({});
      fiatExchangeRateService.fetchExchangeRates.mockResolvedValue({});

      const portfolioMovements: PortfolioMovement[] = [];

      await service.addFiatValues(context, portfolioMovements);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "No quotes found for token polkadot-coingecko-id - polkadot",
        ),
      );
    });

    it("does not fetch quotes if coingeckoId not found", async () => {
      (findCoingeckoIdForNativeToken as jest.Mock).mockReturnValue(null);

      fiatExchangeRateService.fetchExchangeRates.mockResolvedValue({});

      const portfolioMovements: PortfolioMovement[] = [];

      await service.addFiatValues(context, portfolioMovements);

      expect(
        tokenPriceConversionService.fetchQuotesForTokens,
      ).not.toHaveBeenCalled();
    });

    it("does not call convertFiatValues if currency is USD", async () => {
      (findCoingeckoIdForNativeToken as jest.Mock).mockReturnValue("id");

      tokenPriceConversionService.fetchQuotesForTokens.mockResolvedValue({
        id: { currency: "USD", quotes: {} },
      } as any);
      fiatExchangeRateService.fetchExchangeRates.mockResolvedValue({});

      const usdContext = {
        ...context,
        currency: "USD",
      };
      const portfolioMovements: PortfolioMovement[] = [];

      await service.addFiatValues(usdContext, portfolioMovements);

      expect(convertFiatValues).not.toHaveBeenCalled();
    });
  });
});
