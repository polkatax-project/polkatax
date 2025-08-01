import { formatDate } from "../../../common/util/date-utils";
import { PortfolioMovement } from "../model/portfolio-movement";
import { logger } from "../../logger/logger";
import { ExchangeRates } from "../../../model/fiat-exchange-rates/exchange-rates";

/**
 * Converts fiat values in payment objects from USD to the target currency.
 */
export const convertFiatValues = (
  targetCurrency: string,
  portfolioMovements: PortfolioMovement[],
  exchangeRates: ExchangeRates,
): PortfolioMovement[] => {
  for (let portfolioMovement of portfolioMovements) {
    const isoDate = formatDate(new Date(portfolioMovement.timestamp));
    if (exchangeRates[isoDate]) {
      portfolioMovement.transfers.forEach((t) => {
        t.price ??= t.price * exchangeRates[isoDate][targetCurrency];
        t.fiatValue ??= t.fiatValue * exchangeRates[isoDate][targetCurrency];
      });
    } else {
      logger.warn(`No fiat exchange rate found for date ${isoDate}`);
    }
  }
  return portfolioMovements;
};
