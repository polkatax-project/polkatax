# Data Flow and Pricing / Conversion Documentation

## 1. Transaction Data, Rewards, Transfers, etc.

- The Node.js backend fetches data from the [Subscan API](https://subscan.io), including extrinsics, staking rewards, and events such as `balances/deposited`.
- Additionally, a **data collector** processes several blockchain events, for example events of type `staking/reward` and `staking/slash`.
- Currently, the **data collector** operates exclusively on:
  - Polkadot
  - Kusama
  - Hydration
  - Bifrost
- The Node.js backend then cross-references asset movement events with semantically meaningful events, such as `stableswap/liquidityAdded` or `staking/rewarded`, to generate a detailed picture of all asset movements.


## 2. Cryptocurrency Prices

- Historical cryptocurrency prices are exported from [CoinGecko](https://coingecko.com).
- For each staking reward event:
  - The corresponding **fiat value at the end of the day (UTC)** is attached.
  - The reward payout value is calculated using this fiat value.
- If the end-of-day price is not yet available:
  - The fiat value from the previous day is used as a fallback.
- For some less-frequently used fiat currencies, exchange rates are fetched via [exchangerate.host](https://exchangerate.host).  
  Token prices in these currencies are then calculated by multiplying the token price in USD by the corresponding fiat exchange rate.


---


**Note:** All times and data accumulation follow **UTC** timezone to maintain consistency across different sources.


---

## External APIs Summary

| Purpose                  | API / Service              | Notes                              |
|--------------------------|---------------------------|----------------------------------|
| Transactions, transfers, rewards etc.  | Subscan.io API            |     |
| Historical crypto prices | CoinGecko CSV export             | End-of-day prices in selected fiats |
| Historical fiat exchange rates | exchangerate.host API             | End-of-day prices of fiat currencies |

---

*This document is maintained alongside the source code and should be updated with any changes to data fetching or price/conversion logic.*
