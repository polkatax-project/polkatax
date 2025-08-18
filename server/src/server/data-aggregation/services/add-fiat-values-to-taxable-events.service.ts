import { formatDate } from "../../../common/util/date-utils";
import { CurrencyQuotes } from "../../../model/crypto-currency-prices/crypto-currency-quotes";
import { logger } from "../../logger/logger";
import { convertFiatValues } from "../helper/convert-fiat-values";
import { findCoingeckoIdForNativeToken } from "../helper/find-coingecko-id-for-native-token";
import { PortfolioMovement, TaxableEvent } from "../model/portfolio-movement";
import { CryptoCurrencyPricesService } from "./crypto-currency-prices.service";
import { FiatExchangeRateService } from "./fiat-exchange-rate.service";

export class AddFiatValuesToTaxableEventsService {
  constructor(
    private cryptoCurrencyPricesService: CryptoCurrencyPricesService,
    private fiatExchangeRateService: FiatExchangeRateService,
  ) {}

  addFiatValuesForTxFees(
    taxableEvents: TaxableEvent[],
    quotes: CurrencyQuotes,
  ): TaxableEvent[] {
    for (let taxable of taxableEvents as PortfolioMovement[]) {
      const isoDate = formatDate(new Date(taxable.timestamp));
      if (quotes.quotes?.[isoDate]) {
        taxable.feeUsedFiat = taxable.feeUsed
          ? taxable.feeUsed * quotes.quotes[isoDate]
          : undefined;
        taxable.tipFiat = taxable.tip
          ? taxable.tip * quotes.quotes[isoDate]
          : undefined;
      } else {
        logger.warn(
          `No quote found for ${quotes.currency} for date ${isoDate}`,
        );
      }
    }
    return taxableEvents;
  }

  addFiatValuesForNativeToken(
    nativeToken: string,
    taxableEvents: TaxableEvent[],
    quotes: CurrencyQuotes,
  ): TaxableEvent[] {
    for (let taxable of taxableEvents) {
      const isoDate = formatDate(new Date(taxable.timestamp));
      if (quotes.quotes?.[isoDate]) {
        taxable.transfers
          .filter((t) => !t.fiatValue && t.asset_unique_id === nativeToken)
          .forEach((t) => {
            t.price = quotes.quotes[isoDate];
            t.fiatValue = t.amount * quotes.quotes[isoDate];
          });
      } else {
        logger.warn(
          `No quote found for ${quotes.currency} for date ${isoDate}`,
        );
      }
    }
    return taxableEvents;
  }

  private fetchQuotes(
    coingeckoId: string,
    currency: string,
  ): Promise<CurrencyQuotes> {
    try {
      return this.cryptoCurrencyPricesService.fetchHistoricalPrices(
        coingeckoId,
        currency,
      );
    } catch (e) {
      logger.error("Failed to fetch quotes for token " + coingeckoId);
      logger.error(e);
    }
  }

  async addFiatValues(
    context: {
      address: string;
      chain: { domain: string; token: string };
      currency: string;
    },
    taxableEvents: TaxableEvent[],
  ): Promise<void> {
    const coingeckoId = findCoingeckoIdForNativeToken(context.chain.domain);

    const [quotes, fiatExchangeRates] = await Promise.all([
      coingeckoId
        ? this.fetchQuotes(coingeckoId, context.currency)
        : Promise.resolve({ currency: context.currency, quotes: undefined }),
      this.fiatExchangeRateService.fetchExchangeRates(),
    ]);

    // convert fiat values which are given in USD by subscan
    if (context.currency.toUpperCase() !== "USD") {
      convertFiatValues(
        context.currency.toUpperCase(),
        taxableEvents,
        fiatExchangeRates,
      );
    }

    // add quotes to fees and transfer of native token if not already present
    if (!quotes?.quotes) {
      logger.error(
        "No quotes found for token " +
          coingeckoId +
          " - " +
          context.chain.domain,
      );
    } else {
      this.addFiatValuesForTxFees(taxableEvents, quotes);
      this.addFiatValuesForNativeToken(
        context.chain.token,
        taxableEvents,
        quotes,
      );
    }
  }
}
