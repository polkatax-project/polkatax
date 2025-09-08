import { DeviationLimit } from "../model/deviation-limit";

export const DEVIATION_LIMITS: DeviationLimit[] = [
  {
    symbol: "DOT",
    singlePayment: 0.5,
    max: 2,
  },
  {
    symbol: "TBTC",
    singlePayment: 0.001,
    max: 0.001,
  },
  {
    symbol: "WBTC",
    singlePayment: 0.001,
    max: 0.001,
  },
  {
    symbol: "WETH",
    singlePayment: 0.01,
    max: 0.01,
  },
  {
    symbol: "ETH",
    singlePayment: 0.01,
    max: 0.01,
  },
  {
    symbol: "KSM",
    singlePayment: 0.1,
    max: 1,
  },
  {
    symbol: "USDT",
    singlePayment: 0.5,
    max: 2.5,
  },
  {
    symbol: "USDC",
    singlePayment: 0.5,
    max: 2.5,
  },
  {
    symbol: "DAI",
    singlePayment: 0.5,
    max: 2.5,
  },
  {
    symbol: "ASTR",
    singlePayment: 1,
    max: 100,
  },
  {
    symbol: "HDX",
    singlePayment: 1,
    max: 200,
  },
  {
    symbol: "PHA",
    singlePayment: 1,
    max: 100,
  },
  {
    symbol: "MYTH",
    singlePayment: 1,
    max: 10,
  },
  {
    symbol: "EWT",
    singlePayment: 1,
    max: 2,
  },
  {
    symbol: "BNC",
    singlePayment: 1,
    max: 10,
  },
  {
    symbol: "INTR",
    singlePayment: 1,
    max: 100,
  },
  {
    symbol: "GLMR",
    singlePayment: 1,
    max: 10,
  },
];
