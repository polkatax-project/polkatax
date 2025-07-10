import { logger } from "../logger/logger";
import { CoingeckoRestService } from "../coingecko-api/coingecko.rest-service";
import {
  CurrencyQuotes,
  Quotes,
} from "../../model/crypto-currency-prices/crypto-currency-quotes";
import { formatDate } from "../../common/util/date-utils";

export class TokenPriceHistoryService {
  private cachedPrices: { [coingeckoId: string]: Quotes } = {};

  constructor(private coingeckoRestService: CoingeckoRestService) {}

  async getHistoricPrices(
    coingeckoId: string,
    currency: string = "usd",
  ): Promise<CurrencyQuotes> {
    const result = await this.fetchQuotesForId(coingeckoId, currency);
    return { quotes: result, currency };
  }

  private combine(id: string, currency: string) {
    return id + "_" + currency;
  }

  private informationUpToDate(coingeckoId: string, currency: string) {
    const combinedIdx = this.combine(coingeckoId, currency);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return (
      this.cachedPrices[combinedIdx] &&
      this.cachedPrices[combinedIdx][formatDate(yesterday)]
    );
  }

  private async fetchQuotesForId(
    coingeckoId: string,
    currency: string = "usd",
  ) {
    logger.info(
      "Entry fetchQuotesForId for " + coingeckoId + " in " + currency,
    );
    if (this.informationUpToDate(coingeckoId, currency)) {
      logger.info(
        "Exit fetchQuotesForId for " +
          coingeckoId +
          " in " +
          currency +
          ". Returning cached data.",
      );
      return this.cachedPrices[this.combine(coingeckoId, currency)];
    }
    const quotes: Quotes = await this.coingeckoRestService.fetchHistoricalData(
      coingeckoId,
      currency,
    );
    const idCurr = this.combine(coingeckoId, currency);
    this.cachedPrices[idCurr] = quotes;
    logger.info("Exit fetchQuotesForId for " + coingeckoId + " in " + currency);
    return this.cachedPrices[idCurr];
  }
}
