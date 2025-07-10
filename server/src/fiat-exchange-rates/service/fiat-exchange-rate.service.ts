import { ExchangeRateRestService } from "../exchange-rate-api/exchange-rate.rest-service";
import { ExchangeRates } from "../../model/fiat-exchange-rates/exchange-rates";
import { logger } from "../logger/logger";
import { formatDate } from "../../common/util/date-utils";

export class FiatExchangeRateService {
  exchangeRates: ExchangeRates = {};
  private readonly SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

  constructor(private exchangeRateRestService: ExchangeRateRestService) {}

  async init() {
    await this.sync();

    setInterval(() => this.sync().catch(logger.error), this.SYNC_INTERVAL_MS);
  }

  private getEndDate(year: number): string {
    const endOfYear = new Date(year, 11, 31); // December 31
    return endOfYear < new Date() ? `${year}-12-31` : formatDate(new Date());
  }

  private async sync() {
    logger.info("CurrencyExchangeRateService syncing");

    const currentYear = new Date().getFullYear();
    const results: ExchangeRates = { ...this.exchangeRates };

    for (let i = 0; i <= 1; i++) {
      const year = currentYear - i;
      const startDate = `${year}-01-01`;
      const endDate = this.getEndDate(year);

      Object.assign(
        results,
        await this.exchangeRateRestService.fetchTimeSeries(startDate, endDate),
      );
    }

    this.exchangeRates = results;
  }
}
