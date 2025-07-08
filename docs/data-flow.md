# Data Flow and Pricing / Conversion Documentation

## 1. Staking Rewards and Slashes

- The Node.js backend fetches staking rewards and slash data from the [Subscan API](https://subscan.io) using the Reward/Slash endpoints. E.g. for Moonbeam.
- For some chains such as Mythos or Peaq, where the Subscan API does not provide direct reward/slash endpoints:
  - The Node.js backend queries the Subscan API for relevant events, e.g., `collateralstaking/StakingRewardReceived`.
  - It then cross-references these events with corresponding blockchain transfers to compute rewards.
- Additionally, there is an **indexer** that processes blockchain events of type `staking/reward` and `staking/slash` as well as `nominationpools/PaidOut` for the following blockchains:
  - Polkadot
  - Kusama
  - Hydration
  - Enjin-relay
- The indexer captures both:
  - Solo staking rewards/slashes
  - Staking rewards/slashes for nomination pool participants
  - The collected data is **accumulated per day (UTC timezone)**.

## 2. Cryptocurrency Prices

- Historical cryptocurrency prices are exported from [CoinGecko](https://coingecko.com).
- For each (accumulated) staking reward event:
  - The corresponding **fiat value at the end of the day (UTC)** is attached.
  - The reward payout value is calculated using this fiat value.
- If the end-of-day price is not yet available:
  - The fiat value from the previous day is used as a fallback.


---


**Note:** All times and data accumulation follow **UTC** timezone to maintain consistency across different sources.


---

## External APIs Summary

| Purpose                  | API / Service              | Notes                              |
|--------------------------|---------------------------|----------------------------------|
| Staking rewards/slashes  | Subscan.io API            |     |
| Historical crypto prices | CoinGecko CSV export             | End-of-day prices in selected fiats |

---

*This document is maintained alongside the source code and should be updated with any changes to data fetching or price/conversion logic.*
