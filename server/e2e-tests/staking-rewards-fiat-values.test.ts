import { describe, expect, test, beforeAll, afterAll } from "@jest/globals";
import { FastifyInstance } from "fastify";
import { fetchStakingRewards } from "./util/fetch-staking-rewars";
import {
  waitForPortToBeFree,
  waitForPortToBeOccupied,
} from "./util/wait-for-port-to-be-free";
import { cryptoCurrencyPricesServer } from "../src/crypto-currency-prices/crypto-prices.server";

let cryptoPriceServer: FastifyInstance;

beforeAll(async () => {
  await waitForPortToBeFree(3003);
  /**
   * Actual crypto prices from coingecko are used
   */
  cryptoPriceServer = await cryptoCurrencyPricesServer.init();
  await waitForPortToBeOccupied(3003);
});

afterAll(async () => {
  cryptoPriceServer = await cryptoPriceServer.close();
});

describe("Should support multiple currencies", () => {
  test("astar EUR", async () => {
    const { totalAmount, totalFiat } = await fetchStakingRewards(
      "1494RbqK8edUZ9HPcUpR9ifnoJ83fNrLuKMB8EvJgaQPh8vH",
      "astar",
      "EUR",
    );
    expect(totalAmount).toBe(19282.742288529327);
    expect(totalFiat).toBe(1528.7834291430934);
  }, 30_000);

  test("astar CHF", async () => {
    const { totalFiat } = await fetchStakingRewards(
      "1494RbqK8edUZ9HPcUpR9ifnoJ83fNrLuKMB8EvJgaQPh8vH",
      "astar",
      "CHF",
    );
    expect(totalFiat).toBe(1456.770766356449);
  }, 30_000);

  test("astar IDR", async () => {
    const { totalFiat } = await fetchStakingRewards(
      "1494RbqK8edUZ9HPcUpR9ifnoJ83fNrLuKMB8EvJgaQPh8vH",
      "astar",
      "IDR",
    );
    expect(totalFiat).toBe(26228280.096317597);
  }, 30_000);

  test("astar USD", async () => {
    const { totalFiat } = await fetchStakingRewards(
      "1494RbqK8edUZ9HPcUpR9ifnoJ83fNrLuKMB8EvJgaQPh8vH",
      "astar",
      "USD",
    );
    expect(totalFiat).toBe(1652.7254665091305);
  }, 30_000);
});
