import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import {
  startStubs,
  stopStubs,
} from "../shared/helper/fetch-portfolio-movements";
import { waitForPortToBeFree } from "../shared/helper/wait-for-port-to-be-free";
import { PortfolioMovement } from "../../src/server/data-aggregation/model/portfolio-movement";
import { createDIContainer } from "../../src/server/di-container";
import * as fs from "fs";
import { PortfolioMovementsService } from "../../src/server/data-aggregation/services/portfolio-movements.service";
import { PortfolioChangeValidationService } from "../../src/server/data-correction/portfolio-change-validation.service";
import { PortfolioMovementCorrectionService } from "../../src/server/data-correction/portfolio-movement-correction.service";

const acceptedDeviations = [
  {
    symbol: "DOT",
    singlePayment: 0.5,
    max: 20,
  },
  {
    symbol: "TBTC",
    singlePayment: 0.001,
    max: 0.001,
  },
  {
    symbol: "WETH",
    singlePayment: 0.01,
    max: 0.01,
  },
  {
    symbol: "KSM",
    singlePayment: 0.1,
    max: 10,
  },
  {
    symbol: "USDT",
    singlePayment: 0.1,
    max: 10,
  },
  {
    symbol: "ASTR",
    singlePayment: 1,
    max: 500,
  },
  {
    symbol: "HDX",
    singlePayment: 3,
    max: 500,
  },
  {
    symbol: "PHA",
    singlePayment: 1,
    max: 500,
  },
  {
    symbol: "MYTH",
    singlePayment: 0.02,
    max: 100,
  },
  {
    symbol: "EWT",
    singlePayment: 0.01,
    max: 10,
  },
  {
    symbol: "BNC",
    singlePayment: 0.3,
    max: 20,
  },
];

const verifyPortfolioChanges = async (
  address: string,
  chainInfo: { domain: string; label: string; token: string },
) => {
  const container = createDIContainer();
  const portfolioMovementsService: PortfolioMovementsService =
    container.resolve("portfolioMovementsService");

  const minDate = new Date("2024-11-01T00:00:00.000Z");
  const maxDate = new Date("2024-12-31T23:59:59.999Z");

  let { portfolioMovements } =
    (await portfolioMovementsService.fetchPortfolioMovements({
      chain: chainInfo,
      address: address,
      currency: "USD",
      minDate: minDate.getTime(),
      maxDate: maxDate.getTime(),
    })) as {
      portfolioMovements: PortfolioMovement[];
    };

  if (portfolioMovements.length === 0) {
    return;
  }

  const portfolioMovementCorrectionService: PortfolioMovementCorrectionService =
    container.resolve("portfolioMovementCorrectionService");

  await portfolioMovementCorrectionService.fixErrorsAndMissingData(
    chainInfo,
    address,
    portfolioMovements,
    [],
    minDate.getTime(),
    maxDate.getTime(),
  );

  const minBlock = portfolioMovements.reduce(
    (curr, next) => Math.min(curr, next.block ?? Number.MAX_SAFE_INTEGER),
    Number.MAX_SAFE_INTEGER,
  );
  const maxBlock = portfolioMovements.reduce(
    (curr, next) => Math.max(curr, next.block ?? 0),
    0,
  );

  const portfolioChangeValidationService: PortfolioChangeValidationService =
    container.resolve("portfolioChangeValidationService");
  const deviations =
    await portfolioChangeValidationService.calculateDeviationFromExpectation(
      chainInfo,
      address,
      portfolioMovements,
      acceptedDeviations,
      minBlock,
      maxBlock,
    );
  portfolioChangeValidationService.disconnectApi();

  deviations.forEach((d) => {
    if (d.absoluteDeviationTooLarge) {
      console.log(
        `Deviation from expectation too large for ${address} and ${chainInfo.domain}:`,
      );
      console.log(JSON.stringify(d, null, 2));
      fs.writeFileSync(
        "./integration-tests/out-temp/portfolio-movements.json",
        JSON.stringify(portfolioMovements, null, 2),
      );
      expect(d.absoluteDeviationTooLarge).toBeFalsy();
    }
  });
};

beforeAll(async () => {
  await startStubs();
});

afterAll(async () => {
  await stopStubs();
  await waitForPortToBeFree(3003);
  await waitForPortToBeFree(3002);
});

describe("Verify portfolio changes", () => {
  describe("Verify the portfolio change polkadot", () => {
    const chainInfo = { domain: "polkadot", label: "", token: "DOT" };

    test("13fvj4bNfrTo8oW6U8525soRp6vhjAFLum6XBdtqq9yP22E7", async () => {
      await verifyPortfolioChanges(
        "13fvj4bNfrTo8oW6U8525soRp6vhjAFLum6XBdtqq9yP22E7",
        chainInfo,
      );
    }, 600000);

    test("12s37eSMQPEN5cuVyBxk2UypUHntwumqBHy7sJkoKpZ1v3HV", async () => {
      await verifyPortfolioChanges(
        "12s37eSMQPEN5cuVyBxk2UypUHntwumqBHy7sJkoKpZ1v3HV",
        chainInfo,
      );
    }, 600000);
  });

  describe("Verify the portfolio change kusama", () => {
    const chainInfo = { domain: "polkadot", label: "", token: "DOT" };

    test("142zGifFwRrDbFLJD7LvbyoHQAqDaXeHjkxJbUVwmDYBD7Gf", async () => {
      await verifyPortfolioChanges(
        "142zGifFwRrDbFLJD7LvbyoHQAqDaXeHjkxJbUVwmDYBD7Gf",
        chainInfo,
      );
    }, 600000);

    test("142zGifFwRrDbFLJD7LvbyoHQAqDaXeHjkxJbUVwmDYBD7Gf", async () => {
      await verifyPortfolioChanges(
        "142zGifFwRrDbFLJD7LvbyoHQAqDaXeHjkxJbUVwmDYBD7Gf",
        chainInfo,
      );
    }, 600000);
  });

  describe("Verify the portfolio change assethub polkadot", () => {
    const chainInfo = { domain: "assethub-polkadot", label: "", token: "DOT" };

    test("12NM61UnRNNQ1thxEpmUEZpQLq9wCGEhYvAmJwWvyaARja2r", async () => {
      await verifyPortfolioChanges(
        "12NM61UnRNNQ1thxEpmUEZpQLq9wCGEhYvAmJwWvyaARja2r",
        chainInfo,
      );
    }, 600000);
  });

  describe("Verify the portfolio change coretime", () => {
    const chainInfo = { domain: "coretime-polkadot", label: "", token: "DOT" };
    test("15fTH34bbKGMUjF1bLmTqxPYgpg481imThwhWcQfCyktyBzL", async () => {
      await verifyPortfolioChanges(
        "15fTH34bbKGMUjF1bLmTqxPYgpg481imThwhWcQfCyktyBzL",
        chainInfo,
      );
    }, 600000);
  });

  describe("Verify the portfolio change people-polkadot", () => {
    const chainInfo = { domain: "people-polkadot", label: "", token: "DOT" };

    test("16LviqDmEdn49UqeVSw3N1SjoJxRVV1EBbydbEqqaCvdtAsY", async () => {
      await verifyPortfolioChanges(
        "16LviqDmEdn49UqeVSw3N1SjoJxRVV1EBbydbEqqaCvdtAsY",
        chainInfo,
      );
    }, 600000);
  });

  describe("Verify the portfolio change collectives-polkadot", () => {
    const chainInfo = {
      domain: "collectives-polkadot",
      label: "",
      token: "DOT",
    };

    test("1L66uQMKFnXKSZx9pCD5o56GvvP1i2Qns7CaS2AaKp9mnwc", async () => {
      await verifyPortfolioChanges(
        "1L66uQMKFnXKSZx9pCD5o56GvvP1i2Qns7CaS2AaKp9mnwc",
        chainInfo,
      );
    }, 600000);
  });

  describe("Verify the portfolio change Acala", () => {
    const chainInfo = { domain: "acala", label: "", token: "ACA" };

    test("1UA2r4UWyAJfWyCEb39oevsUxuzB8XeriJSsdzVtoLNzddr", async () => {
      await verifyPortfolioChanges(
        "1UA2r4UWyAJfWyCEb39oevsUxuzB8XeriJSsdzVtoLNzddr",
        chainInfo,
      );
    }, 600000);
  });

  describe("Verify the portfolio change astar", () => {
    const chainInfo = { domain: "astar", label: "", token: "ASTR" };

    test("13hDgWbatzrMmdPGz4F3Y63vP3qmdac7PUrujcN5a8nB6CkJ", async () => {
      await verifyPortfolioChanges(
        "13hDgWbatzrMmdPGz4F3Y63vP3qmdac7PUrujcN5a8nB6CkJ",
        chainInfo,
      );
    }, 600000);
  });

  describe("Verify the portfolio change hydration", () => {
    const chainInfo = { domain: "hydration", label: "", token: "HDX" };

    test("15Vut6ZxJNKSCJY87DLtZZbFyWyR1LBwXhAc7wqwVRK3ioWN", async () => {
      await verifyPortfolioChanges(
        "15Vut6ZxJNKSCJY87DLtZZbFyWyR1LBwXhAc7wqwVRK3ioWN",
        chainInfo,
      );
    }, 600000);
  });

  describe("Verify the portfolio change manta", () => {
    const chainInfo = { domain: "manta", label: "", token: "MANTA" };
    test("13ziS42MVCDz1biV4CdYUyBFLSYBKAfN6wBAf6nghe1hp7EQ", async () => {
      await verifyPortfolioChanges(
        "13ziS42MVCDz1biV4CdYUyBFLSYBKAfN6wBAf6nghe1hp7EQ",
        chainInfo,
      );
    }, 600000);
  });
});
