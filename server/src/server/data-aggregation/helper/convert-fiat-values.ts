import { formatDate } from "../../../common/util/date-utils";
import { TaxableEvent } from "../model/portfolio-movement";
import { logger } from "../../logger/logger";
import { ExchangeRates } from "../../../model/fiat-exchange-rates/exchange-rates";

/**
 * Converts fiat values in payment objects from USD to the target currency.
 */
export const convertFiatValues = (
  targetCurrency: string,
  taxableEvents: TaxableEvent[],
  exchangeRates: ExchangeRates,
): TaxableEvent[] => {
  for (let taxable of taxableEvents) {
    const isoDate = formatDate(new Date(taxable.timestamp));
    if (exchangeRates[isoDate]) {
      taxable.transfers.forEach((t) => {
        t.price = t.price * exchangeRates[isoDate][targetCurrency];
        t.fiatValue = t.fiatValue * exchangeRates[isoDate][targetCurrency];
      });
    } else {
      logger.warn(`No fiat exchange rate found for date ${isoDate}`);
    }
  }
  return taxableEvents;
};
