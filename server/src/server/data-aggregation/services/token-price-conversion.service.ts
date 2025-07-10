import { logger } from "../../logger/logger";
import { CurrencyQuotes } from "../../../model/crypto-currency-prices/crypto-currency-quotes";
import { CryptoCurrencyPricesService } from "./crypto-currency-prices.service";

export class TokenPriceConversionService {
  constructor(
    private cryptoCurrencyPricesService: CryptoCurrencyPricesService,
  ) {}

  public async fetchQuotesForTokens(
    tokenIds: string[],
    currency: string,
  ): Promise<{ [token: string]: CurrencyQuotes }> {
    logger.info(
      `Entry fetchQuotesForTokens ${tokenIds.join(", ")} in ${currency}`,
    );
    const result = {};
    for (let i = 0; i < tokenIds.length; i++) {
      try {
        result[tokenIds[i]] =
          await this.cryptoCurrencyPricesService.fetchHistoricalPrices(
            tokenIds[i],
            currency,
          );
      } catch (e) {
        logger.error("Failed to fetch quotes for token " + tokenIds[i]);
        logger.error(e);
      }
    }
    logger.info(`Exit fetchQuotesForTokens`);
    return result;
  }
}
