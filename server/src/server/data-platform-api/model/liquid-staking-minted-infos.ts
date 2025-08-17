import { CurrencyType } from "./currency-type";

export interface LiquidStakingMintedInfos {
  chainType: string;
  liquidStakingResults: {
    executionDate: string;
    totalAmount: number;
    totalVestedAmount: number;
    currencyType: CurrencyType;
    currencyValue?: string;
    mintFee?: number;
  }[];
}
