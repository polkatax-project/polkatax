import { formatDate } from "../../../common/util/date-utils";
import { CurrencyQuotes } from "../../../model/crypto-currency-prices/crypto-currency-quotes";
import { StakingReward } from "../../blockchain/substrate/model/staking-reward";
import { PricedStakingReward } from "../model/priced-staking-reward";
import { addFiatValueToTransfer } from "./add-fiat-values-to-transfers";

export const addFiatValuesToStakingRewards = (
  values: PricedStakingReward[],
  quotes: CurrencyQuotes,
): PricedStakingReward[] => {
  const currentIsoDate = formatDate(new Date());
  for (let d of values) {
    addFiatValueToTransfer(d, quotes, currentIsoDate, d.timestamp);
  }
  return values;
};
