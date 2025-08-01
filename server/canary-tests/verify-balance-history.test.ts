import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { verifyNativeBalanceHistory } from "./verify-balance-history";
import { startStubs, stopStubs } from "./helper/fetch-portfolio-movements";
import { waitForPortToBeFree } from "../e2e-tests/util/wait-for-port-to-be-free";

async function verify(address, chain) {
  const today = new Date();
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - 7);
  const chainInfo =
    chain === "polkadot"
      ? { domain: "polkadot", label: "", token: "DOT" }
      : { domain: "kusama", label: "", token: "KSM" };
  const unexplainedChanges = await verifyNativeBalanceHistory(
    address,
    chainInfo,
    pastDate.getTime(),
  );
  const sumOfDifferences = unexplainedChanges.reduce(
    (curr, next) => (curr += next.deviationFromExpectation),
    0,
  );
  expect(sumOfDifferences).toBeLessThan(1);
}

beforeAll(async () => {
  await startStubs();
});

afterAll(async () => {
  await stopStubs();
  await waitForPortToBeFree(3003);
  await waitForPortToBeFree(3002);
});

describe("Verify the balance changes of various users on Kusama and Polkadot relay chains", () => {
  test("Polkadot-13fvj4bNfrTo8oW6U8525soRp6vhjAFLum6XBdtqq9yP22E7", async () => {
    await verify(
      "13fvj4bNfrTo8oW6U8525soRp6vhjAFLum6XBdtqq9yP22E7",
      "polkadot",
    );
  });

  test("Polkadot-1eGtATyy4ayn77dsrhdW8N3Vs1yjqjzJcintksNmScqy31j", async () => {
    await verify("1eGtATyy4ayn77dsrhdW8N3Vs1yjqjzJcintksNmScqy31j", "polkadot");
  });

  test("Polkadot-12s37eSMQPEN5cuVyBxk2UypUHntwumqBHy7sJkoKpZ1v3HV", async () => {
    await verify(
      "12s37eSMQPEN5cuVyBxk2UypUHntwumqBHy7sJkoKpZ1v3HV",
      "polkadot",
    );
  });

  test("Polkadot-14gEYLb4pzg3RvYS72MPRWWGAUBDdBpp9U6Wh4uMZhdQRis2", async () => {
    await verify(
      "14gEYLb4pzg3RvYS72MPRWWGAUBDdBpp9U6Wh4uMZhdQRis2",
      "polkadot",
    );
  });

  test("Polkadot-12s37eSMQPEN5cuVyBxk2UypUHntwumqBHy7sJkoKpZ1v3HV", async () => {
    await verify(
      "12s37eSMQPEN5cuVyBxk2UypUHntwumqBHy7sJkoKpZ1v3HV",
      "polkadot",
    );
  });

  test("Kusama-14MY5bH76Yxi8s3Ujgpgehh7aadfyKL4eW98gZgXYDZGgpLX", async () => {
    await verify("14MY5bH76Yxi8s3Ujgpgehh7aadfyKL4eW98gZgXYDZGgpLX", "kusama");
  });

  test("Kusama-142zGifFwRrDbFLJD7LvbyoHQAqDaXeHjkxJbUVwmDYBD7Gf", async () => {
    await verify("142zGifFwRrDbFLJD7LvbyoHQAqDaXeHjkxJbUVwmDYBD7Gf", "kusama");
  });

  test("Kusama-12WWjrZGuVxyk5AyFeDGaN45J1FJ6MesXRxhmY41rhKxL961", async () => {
    await verify("12WWjrZGuVxyk5AyFeDGaN45J1FJ6MesXRxhmY41rhKxL961", "kusama");
  });

  test("Kusama-1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", async () => {
    await verify("1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", "kusama");
  });

  test("Polkadot-1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", async () => {
    await verify("1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", "polkadot");
  });

  test("Polkadot-15tZKWzhNFM1dpjKvjt4cYhZ9uJKyEZ6McrqwtYFwCVG8XUh", async () => {
    await verify(
      "15tZKWzhNFM1dpjKvjt4cYhZ9uJKyEZ6McrqwtYFwCVG8XUh",
      "polkadot",
    );
  });
});
