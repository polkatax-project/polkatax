import { formatDate } from "../../../common/util/date-utils";
import { CurrencyQuotes } from "../../../model/crypto-currency-prices/crypto-currency-quotes";
import { logger } from "../../logger/logger";
import { convertFiatValues } from "../helper/convert-fiat-values";
import { findCoingeckoIdForNativeToken } from "../helper/find-coingecko-id-for-native-token";
import { Payment } from "../model/payment";
import { FiatExchangeRateService } from "./fiat-exchange-rate.service";
import { TokenPriceConversionService } from "./token-price-conversion.service";

export class AddFiatValuesToPaymentsService {
  constructor(
    private tokenPriceConversionService: TokenPriceConversionService,
    private fiatExchangeRateService: FiatExchangeRateService,
  ) {}

  addFiatValuesForTxFeesAndStakingRewards(
    payments: Payment[],
    quotes: CurrencyQuotes,
  ): Payment[] {
    for (let payment of payments) {
      const isoDate = formatDate(new Date(payment.timestamp));
      if (quotes.quotes?.[isoDate]) {
        payment.feeUsedFiat = payment.feeUsed
          ? payment.feeUsed * quotes.quotes[isoDate]
          : undefined;
        payment.tipFiat = payment.tip
          ? payment.tip * quotes.quotes[isoDate]
          : undefined;
        if (payment.provenance === "stakingRewards") {
          payment.transfers.forEach((t) => {
            t.fiatValue ??= t.amount * quotes.quotes[isoDate];
            t.price ??= quotes.quotes[isoDate];
          });
        }
      } else {
        logger.warn(
          `No quote found for ${quotes.currency} for date ${isoDate}`,
        );
      }
    }
    return payments;
  }

  async addFiatValues(
    context: {
      address: string;
      chain: { domain: string; token: string };
      currency: string;
    },
    payments: Payment[],
  ): Promise<void> {
    const coingeckoId = findCoingeckoIdForNativeToken(context.chain.domain);

    const [quotes, fiatExchangeRates] = await Promise.all([
      coingeckoId
        ? this.tokenPriceConversionService.fetchQuotesForTokens(
            [coingeckoId],
            context.currency,
          )
        : Promise.resolve({}),
      this.fiatExchangeRateService.fetchExchangeRates(),
    ]);

    // convert fiat values which are given in USD by subscan
    if (context.currency.toUpperCase() !== "USD") {
      convertFiatValues(
        context.currency.toUpperCase(),
        payments,
        fiatExchangeRates,
      );
    }

    // add quotes to fees and staking rewards
    this.addFiatValuesForTxFeesAndStakingRewards(payments, quotes[coingeckoId]);
  }
}
