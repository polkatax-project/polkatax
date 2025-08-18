import { AddFiatValuesToTaxableEventsService } from "./add-fiat-values-to-taxable-events.service";
import { CryptoCurrencyPricesService } from "./crypto-currency-prices.service";
import { FiatExchangeRateService } from "./fiat-exchange-rate.service";
import { logger } from "../../logger/logger";
import { convertFiatValues } from "../helper/convert-fiat-values";
import { findCoingeckoIdForNativeToken } from "../helper/find-coingecko-id-for-native-token";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { PortfolioMovement } from "../model/portfolio-movement";

jest.mock("../../logger/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));

jest.mock("../helper/convert-fiat-values", () => ({
  convertFiatValues: jest.fn(),
}));

jest.mock("../helper/find-coingecko-id-for-native-token", () => ({
  findCoingeckoIdForNativeToken: jest.fn(),
}));

describe("AddFiatValuesToTaxableEventsService", () => {
  let service: AddFiatValuesToTaxableEventsService;
  let cryptoCurrencyPricesService: jest.Mocked<CryptoCurrencyPricesService>;
  let fiatExchangeRateService: jest.Mocked<FiatExchangeRateService>;

  beforeEach(() => {
    cryptoCurrencyPricesService = {
      fetchHistoricalPrices: jest.fn<any>(),
    } as any;

    fiatExchangeRateService = {
      fetchExchangeRates: jest.fn<any>(),
    } as any;

    service = new AddFiatValuesToTaxableEventsService(
      cryptoCurrencyPricesService,
      fiatExchangeRateService,
    );

    jest.clearAllMocks();
  });

  describe("addFiatValuesForTxFees", () => {
    it("adds fiat values for feeUsed and tip if quotes exist", () => {
      const taxableEvents: any = [
        { timestamp: "2023-01-01T00:00:00Z", feeUsed: 2, tip: 3 },
      ];
      const quotes = { currency: "USD", quotes: { "2023-01-01": 10 } };

      const result = service.addFiatValuesForTxFees(
        taxableEvents,
        quotes as any,
      );

      expect((result[0] as PortfolioMovement).feeUsedFiat).toBe(20);
      expect((result[0] as PortfolioMovement).tipFiat).toBe(30);
    });

    it("logs a warning if no quote is found", () => {
      const taxableEvents: any = [{ timestamp: "2023-01-01T00:00:00Z" }];
      const quotes = { currency: "USD", quotes: {} };

      service.addFiatValuesForTxFees(taxableEvents, quotes as any);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No quote found"),
      );
    });
  });

  describe("addFiatValuesForNativeToken", () => {
    it("adds fiat values for transfers with native token", () => {
      const taxableEvents: any = [
        {
          timestamp: "2023-01-01T00:00:00Z",
          transfers: [
            { asset_unique_id: "DOT", amount: 5, fiatValue: undefined },
          ],
        },
      ];
      const quotes = { currency: "USD", quotes: { "2023-01-01": 2 } };

      service.addFiatValuesForNativeToken("DOT", taxableEvents, quotes as any);

      expect(taxableEvents[0].transfers[0].price).toBe(2);
      expect(taxableEvents[0].transfers[0].fiatValue).toBe(10);
    });

    it("logs a warning if no quote exists", () => {
      const taxableEvents: any = [
        { timestamp: "2023-01-01T00:00:00Z", transfers: [] },
      ];
      const quotes = { currency: "USD", quotes: {} };

      service.addFiatValuesForNativeToken("DOT", taxableEvents, quotes as any);

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe("addFiatValues", () => {
    it("fetches quotes and applies conversions", async () => {
      (findCoingeckoIdForNativeToken as jest.Mock).mockReturnValue("dot");
      cryptoCurrencyPricesService.fetchHistoricalPrices.mockResolvedValue({
        currency: "EUR",
        quotes: { "2023-01-01": 5 },
      } as any);
      fiatExchangeRateService.fetchExchangeRates.mockResolvedValue({
        EUR: 1.2,
      } as any);

      const taxableEvents: any = [
        {
          timestamp: "2023-01-01T00:00:00Z",
          feeUsed: 1,
          tip: 1,
          transfers: [{ asset_unique_id: "DOT", amount: 2 }],
        },
      ];

      await service.addFiatValues(
        {
          address: "addr",
          chain: { domain: "polkadot", token: "DOT" },
          currency: "EUR",
        },
        taxableEvents,
      );

      expect(
        cryptoCurrencyPricesService.fetchHistoricalPrices,
      ).toHaveBeenCalledWith("dot", "EUR");
      expect(convertFiatValues).toHaveBeenCalled();
      expect(taxableEvents[0].feeUsedFiat).toBe(5);
      expect(taxableEvents[0].tipFiat).toBe(5);
      expect(taxableEvents[0].transfers[0].fiatValue).toBe(10);
    });

    it("logs error when no quotes found", async () => {
      (findCoingeckoIdForNativeToken as jest.Mock).mockReturnValue("dot");
      cryptoCurrencyPricesService.fetchHistoricalPrices.mockResolvedValue({
        currency: "USD",
        quotes: undefined,
      });
      fiatExchangeRateService.fetchExchangeRates.mockResolvedValue({});

      const taxableEvents: any = [
        { timestamp: "2023-01-01T00:00:00Z", transfers: [] },
      ];

      await service.addFiatValues(
        {
          address: "addr",
          chain: { domain: "polkadot", token: "DOT" },
          currency: "USD",
        },
        taxableEvents,
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("No quotes found"),
      );
    });
  });
});
