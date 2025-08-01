import { formatDate } from "../../../common/util/date-utils";
import { CurrencyQuotes } from "../../../model/crypto-currency-prices/crypto-currency-quotes";
import { logger } from "../../logger/logger";
import { convertFiatValues } from "../helper/convert-fiat-values";
import { findCoingeckoIdForNativeToken } from "../helper/find-coingecko-id-for-native-token";
import { PortfolioMovement } from "../model/portfolio-movement";
import { FiatExchangeRateService } from "./fiat-exchange-rate.service";
import { TokenPriceConversionService } from "./token-price-conversion.service";

export class AddFiatValuesToPortfolioMovementsService {
  constructor(
    private tokenPriceConversionService: TokenPriceConversionService,
    private fiatExchangeRateService: FiatExchangeRateService,
  ) {}

  addFiatValuesForTxFeesAndStakingRewards(
    portfolioMovements: PortfolioMovement[],
    quotes: CurrencyQuotes,
  ): PortfolioMovement[] {
    for (let portfolioMovement of portfolioMovements) {
      const isoDate = formatDate(new Date(portfolioMovement.timestamp));
      if (quotes.quotes?.[isoDate]) {
        portfolioMovement.feeUsedFiat = portfolioMovement.feeUsed
          ? portfolioMovement.feeUsed * quotes.quotes[isoDate]
          : undefined;
        portfolioMovement.tipFiat = portfolioMovement.tip
          ? portfolioMovement.tip * quotes.quotes[isoDate]
          : undefined;
        if (portfolioMovement.provenance === "stakingRewards") {
          portfolioMovement.transfers.forEach((t) => {
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
    return portfolioMovements;
  }

  async addFiatValues(
    context: {
      address: string;
      chain: { domain: string; token: string };
      currency: string;
    },
    portfolioMovements: PortfolioMovement[],
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
        portfolioMovements,
        fiatExchangeRates,
      );
    }

    // add quotes to fees and staking rewards
    this.addFiatValuesForTxFeesAndStakingRewards(
      portfolioMovements,
      quotes[coingeckoId],
    );
  }
}
