import { CurrencyType } from "./currency-type";

export interface LiquidStakingRedeemedInfos {
  chainType: string;
  liquidStakingResults: {
    eventId: string;
    timestamp: string;
    currencyType: CurrencyType;
    currencyValue: string;
    currencyAmount: number;
    vestedCurrencyAmount: number;
    redeemFee: number;
  }[];
}
