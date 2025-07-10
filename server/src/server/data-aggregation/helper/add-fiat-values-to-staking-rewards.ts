import { formatDate } from "../../../common/util/date-utils";
import { CurrencyQuotes } from "../../../model/crypto-currency-prices/crypto-currency-quotes";
import { logger } from "../../logger/logger";
import { PricedStakingReward } from "../model/priced-staking-reward";

export const addFiatValuesToStakingRewards = (
  values: PricedStakingReward[],
  quotes: CurrencyQuotes,
): PricedStakingReward[] => {
  if (!quotes) {
    return values;
  }
  const currentIsoDate = formatDate(new Date());
  for (let d of values) {
    addFiatValueToTransfer(d, quotes, currentIsoDate, d.timestamp);
  }
  return values;
};

export const addFiatValueToTransfer = (
  transfer: {
    price?: number;
    fiatValue?: number;
    amount: number;
  },
  quotes: CurrencyQuotes,
  currentIsoDate: string,
  timestamp: number,
) => {
  const isoDate = formatDate(new Date(timestamp));
  if (isoDate === currentIsoDate && quotes.quotes.latest) {
    transfer.price = quotes.quotes.latest;
    transfer.fiatValue = transfer.amount * quotes.quotes.latest;
  } else if (quotes.quotes?.[isoDate]) {
    transfer.price = quotes.quotes[isoDate];
    transfer.fiatValue = transfer.amount * transfer.price;
  } else if (isoDate !== currentIsoDate) {
    logger.warn(`No quote found for ${quotes.currency} for date ${isoDate}`);
  }
};
