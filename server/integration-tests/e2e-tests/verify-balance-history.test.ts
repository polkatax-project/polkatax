import { afterAll, beforeAll, describe, test } from "@jest/globals";
import { verifyBalanceHistory } from "../shared/verify-balance-history";
import {
  startStubs,
  stopStubs,
} from "../shared/helper/fetch-portfolio-movements";
import { waitForPortToBeFree } from "../shared/helper//wait-for-port-to-be-free";

async function verify(address, chain) {
  const minDate = new Date(
    `${new Date().getFullYear() - 1}-10-01T00:00:00.000Z`,
  );
  const maxDate = new Date(
    `${new Date().getFullYear() - 1}-12-31T00:00:00.000Z`,
  );
  await verifyBalanceHistory(
    address,
    chain,
    minDate.getTime(),
    maxDate.getTime(),
    3,
  );
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
  }, 600000);

  test("Polkadot-12s37eSMQPEN5cuVyBxk2UypUHntwumqBHy7sJkoKpZ1v3HV", async () => {
    await verify(
      "12s37eSMQPEN5cuVyBxk2UypUHntwumqBHy7sJkoKpZ1v3HV",
      "polkadot",
    );
  }, 600000);

  test("Kusama-142zGifFwRrDbFLJD7LvbyoHQAqDaXeHjkxJbUVwmDYBD7Gf", async () => {
    await verify("142zGifFwRrDbFLJD7LvbyoHQAqDaXeHjkxJbUVwmDYBD7Gf", "kusama");
  }, 600000);

  test("Kusama-1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", async () => {
    await verify("1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", "kusama");
  }, 600000);
});
