import { CurrencyType } from "./currency-type";

export interface LiquidStakingRedeemedInfos {
  chainType: string;
  liquidStakingResults: {
    redeemDate: string;
    currencyType: CurrencyType;
    currencyValue: string;
    currencyAmount: number;
    redeemFee: number;
  }[];
}
