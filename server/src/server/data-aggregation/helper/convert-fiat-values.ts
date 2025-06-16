import { formatDate } from "../../../common/util/date-utils";
import { Payment } from "../model/payment";
import { logger } from "../../logger/logger";
import { ExchangeRates } from "../../../model/fiat-exchange-rates/exchange-rates";

/**
 * Converts fiat values in payment objects from USD to the target currency.
 */
export const convertFiatValues = (
  targetCurrency: string,
  payments: Payment[],
  exchangeRates: ExchangeRates,
): Payment[] => {
  for (let payment of payments) {
    const isoDate = formatDate(new Date(payment.timestamp));
    if (exchangeRates[isoDate]) {
      payment.transfers.forEach((t) => {
        t.price ??= t.price * exchangeRates[isoDate][targetCurrency];
        t.fiatValue ??= t.fiatValue * exchangeRates[isoDate][targetCurrency];
      });
    } else {
      logger.warn(`No fiat exchange rate found for date ${isoDate}`);
    }
  }
  return payments;
};
