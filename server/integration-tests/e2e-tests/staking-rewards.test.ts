import { describe, expect, test, beforeAll, afterAll } from "@jest/globals";
import { FastifyInstance } from "fastify";
import { startStub as cryptoPricesStub } from "../../src/crypto-currency-prices/stub";
import { fetchStakingRewards } from "./util/fetch-staking-rewars";
import {
  waitForPortToBeFree,
  waitForPortToBeOccupied,
} from "../shared/helper/wait-for-port-to-be-free";

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

  test("energywebx", async () => {
    const { totalAmount } = await fetchStakingRewards(
      "15zPrrWEwuzZ3auTtpeGeWJa8e6Wpvdb1tTXmuwRXX9P1NmD",
      "energywebx",
      "USDT",
      new Date("2025-08-01T00:00:00.000").getTime(),
      new Date("2025-09-17T00:00:00.000").getTime(),
    );
    expect(totalAmount).toBe(0.000024653772072369002);
  }, 60_000);

  test("mythos", async () => {
    const { totalAmount } = await fetchStakingRewards(
      "0x56F17ebFe6B126E9f196e7a87f74e9f026a27A1F",
      "mythos",
      "USDT",
      new Date("2025-08-01T00:00:00.000").getTime(),
      new Date("2025-09-17T00:00:00.000").getTime(),
    );
    expect(totalAmount).toBe(9023.513479731777);
  }, 60_000);

  test("peaq", async () => {
    const { totalAmount } = await fetchStakingRewards(
      "16RzLe5chqj86NNpWUdKAmNJH4QgvEJqu3wE4PeZPFjLY2Xn",
      "peaq",
      "USDT",
      new Date("2025-08-01T00:00:00.000").getTime(),
      new Date("2025-09-17T00:00:00.000").getTime(),
    );
    expect(totalAmount).toBe(0.007934913367749903);
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
