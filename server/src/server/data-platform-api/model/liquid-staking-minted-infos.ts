import { CurrencyType } from "./currency-type";

export interface LiquidStakingMintedInfos {
  chainType: string;
  liquidStakingResults: {
    eventId: string;
    timestamp: string;
    amount: number;
    vestedAmount: number;
    currencyType: CurrencyType;
    currencyValue?: string;
    mintFee?: number;
  }[];
}
