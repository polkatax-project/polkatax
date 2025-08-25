import { CurrencyType } from "./currency-type";

export interface LiquidStakingRebondedInfos {
  chainType: string;
  liquidStakingResults: {
    eventId: string;
    timestamp: string;
    currencyType: CurrencyType;
    currencyValue: string;
    currencyAmount: number;
    vestedCurrencyAmount: number;
    rebondFee: number;
    extrinsicId: string;
  }[];
}
