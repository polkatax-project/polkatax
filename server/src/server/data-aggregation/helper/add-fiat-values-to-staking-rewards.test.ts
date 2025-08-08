import { expect, it, jest, describe, beforeEach, afterEach } from "@jest/globals";
import * as dateUtils from "../../../common/util/date-utils";
import { logger } from "../../logger/logger";
import { CurrencyQuotes } from "../../../model/crypto-currency-prices/crypto-currency-quotes";
import { StakingReward } from "../../blockchain/substrate/model/staking-reward";
import { AggregatedStakingReward } from "../model/aggregated-staking-reward";
import { addFiatValuesToAggregatedStakingRewards, addFiatValuesToStakingRewards, addFiatValueToTransfer } from "./add-fiat-values-to-staking-rewards";

jest.mock("../../logger/logger", () => ({
  logger: { warn: jest.fn() },
}));

describe("addFiatValueToTransfer", () => {
  const latestDate = "2025-08-08";
  const pastDate = "2025-07-01";

  const quotes: CurrencyQuotes = {
    currency: "USD",
    quotes: {
      latest: 10,
      [pastDate]: 5,
    },
  } as any;

  beforeEach(() => {
    jest.spyOn(dateUtils, "formatDate").mockImplementation((date: Date) => {
      const iso = date.toISOString().split("T")[0];
      return iso === "2025-08-08" ? latestDate : pastDate;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("uses latest quote if date is today", () => {
    const transfer = { amount: 2 } as any;

    addFiatValueToTransfer(transfer, quotes, latestDate, new Date("2025-08-08").getTime());

    expect(transfer.price).toBe(10);
    expect(transfer.fiatValue).toBe(20);
  });

  it("uses historical quote if date is in the past", () => {
    const transfer = { amount: 3 } as any;

    addFiatValueToTransfer(transfer, quotes, latestDate, new Date("2025-07-01").getTime());

    expect(transfer.price).toBe(5);
    expect(transfer.fiatValue).toBe(15);
  });

  it("logs warning if no quote exists for past date", () => {
    const transfer = { amount: 1 };
    const badQuotes = {
      currency: "USD",
      quotes: {
        latest: 10,
        // missing 2025-07-01
      },
    } as any;

    addFiatValueToTransfer(transfer, badQuotes, latestDate, new Date("2025-07-01").getTime());

    expect(logger.warn).toHaveBeenCalledWith("No quote found for USD for date 2025-07-01");
  });
});

describe("addFiatValuesToStakingRewards", () => {
  const currentDate = "2025-08-08";

  beforeEach(() => {
    jest.spyOn(dateUtils, "formatDate").mockReturnValue(currentDate);
  });

  it("updates rewards with fiat value using latest quote", () => {
    const rewards: StakingReward[] = [
      {
        timestamp: new Date("2025-08-08").getTime(),
        amount: 2,
      },
    ] as any;

    const quotes: CurrencyQuotes = {
      currency: "USD",
      quotes: {
        latest: 4,
      },
    } as any;

    const result = addFiatValuesToStakingRewards(rewards, quotes);

    expect(result[0].price).toBe(4);
    expect(result[0].fiatValue).toBe(8);
  });

  it("returns input unchanged if no quotes", () => {
    const rewards: StakingReward[] = [
      { timestamp: Date.now(), amount: 2 },
    ] as any;

    const result = addFiatValuesToStakingRewards(rewards, undefined as any);

    expect(result).toBe(rewards);
  });
});

describe("addFiatValuesToAggregatedStakingRewards", () => {
  const currentDate = "2025-08-08";

  beforeEach(() => {
    jest.spyOn(dateUtils, "formatDate").mockReturnValue(currentDate);
  });

  it("updates aggregated rewards with fiat values", () => {
    const rewards: AggregatedStakingReward[] = [
      {
        timestamp: new Date("2025-08-08").getTime(),
        transfers: [{ amount: 3 }],
      },
    ] as any;

    const quotes: CurrencyQuotes = {
      currency: "USD",
      quotes: {
        latest: 2,
      },
    } as any;

    const result = addFiatValuesToAggregatedStakingRewards(rewards, quotes);

    expect(result[0].transfers[0].price).toBe(2);
    expect(result[0].transfers[0].fiatValue).toBe(6);
  });

  it("returns input unchanged if quotes missing", () => {
    const rewards: AggregatedStakingReward[] = [
      {
        timestamp: Date.now(),
        transfers: [{ amount: 1 }],
      },
    ] as any;

    const result = addFiatValuesToAggregatedStakingRewards(rewards, undefined as any);

    expect(result).toBe(rewards);
  });
});