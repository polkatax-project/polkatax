import { CurrencyType } from "./currency-type";

export interface LiquidStakingRebondedInfos {
  chainType: string;
  liquidStakingResults: {
    rebondDate: string;
    currencyType: CurrencyType;
    currencyValue: string;
    currencyAmount: number;
    vestedCurrencyAmount: number;
    rebondFee: number;
  }[];
}
