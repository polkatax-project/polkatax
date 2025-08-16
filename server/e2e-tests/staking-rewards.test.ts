import { describe, expect, test, beforeAll, afterAll } from "@jest/globals";
import { FastifyInstance } from "fastify";
import { startStub as cryptoPricesStub } from "../src/crypto-currency-prices/stub";
import { fetchStakingRewards } from "./util/fetch-staking-rewars";
import {
  waitForPortToBeFree,
  waitForPortToBeOccupied,
} from "./util/wait-for-port-to-be-free";

let cryptoPriceServer: FastifyInstance;

beforeAll(async () => {
  await waitForPortToBeFree(3003);
  /**
   * Crypto prices are mocked.
   */
  cryptoPriceServer = await cryptoPricesStub();
  await waitForPortToBeOccupied(3003);
});

afterAll(async () => {
  await cryptoPriceServer.close();
});

describe("Staking rewards amounts", () => {
  test("kusama", async () => {
    const { totalAmount } = await fetchStakingRewards(
      "15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB",
      "kusama",
    );
    expect(totalAmount).toBe(48.988706091223946);
  }, 30_000);

  test("moonbeam", async () => {
    const { totalAmount } = await fetchStakingRewards(
      "0xd8C8f8E07F779C34aEc474bA1A04E20E792b5c5f",
      "moonbeam",
    );
    expect(totalAmount).toBe(184.17376356100766);
  }, 60_000);

  test("creditcoin", async () => {
    const { rewards } = await fetchStakingRewards(
      "1248rdoFUtNnSM77Udm9AsRx5xeH2kucW1asgYhNdGCU3syf",
      "creditcoin",
      "USD",
      Date.UTC(2024, 0, 1),
      Date.UTC(2025, 5, 1),
    );
    const slashes = rewards.values.filter((v) => v.amount < 0);
    expect(slashes.length).toBe(4);
    const total = rewards.values.reduce((current, value) => {
      return current + value.amount;
    }, 0);
    expect(total).toBe(16088.424456785922);
  }, 30_000);
});
