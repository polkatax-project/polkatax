import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import {
  startStubs,
  stopStubs,
} from "../shared/helper/fetch-portfolio-movements";
import { waitForPortToBeFree } from "../shared/helper/wait-for-port-to-be-free";
import { PortfolioMovement } from "../../src/server/data-aggregation/model/portfolio-movement";
import { PortfolioChangeValidationService } from "../../src/server/data-aggregation/services/portfolio-change-validation.service";
import { createDIContainer } from "../../src/server/di-container";
import { PortfolioMovementsService } from "../../src/server/data-aggregation/services/portfolio-movements.service";
import * as fs from "fs";

const acceptedDeviations = [
  {
    symbol: "DOT",
    perPayment: 0.5,
    max: 20,
  },
  {
    symbol: "TBTC",
    perPayment: 0.001,
    max: 0.001,
  },
  {
    symbol: "WETH",
    perPayment: 0.01,
    max: 0.01,
  },
  {
    symbol: "KSM",
    perPayment: 0.1,
    max: 10,
  },
  {
    symbol: "USDT",
    perPayment: 0.1,
    max: 10,
  },
  {
    symbol: "ASTR",
    perPayment: 1,
    max: 500,
  },
  {
    symbol: "HDX",
    perPayment: 3,
    max: 500,
  },
  {
    symbol: "PHA",
    perPayment: 1,
    max: 500,
  },
  {
    symbol: "MYTH",
    perPayment: 0.02,
    max: 100,
  },
  {
    symbol: "EWT",
    perPayment: 0.01,
    max: 10,
  },
  {
    symbol: "BNC",
    perPayment: 0.3,
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

  const portfolioChangeValidationService: PortfolioChangeValidationService =
    container.resolve("portfolioChangeValidationService");
  const deviations = await portfolioChangeValidationService.validate(
    chainInfo,
    address,
    portfolioMovements,
    acceptedDeviations,
  );
  deviations.forEach((d) => {
    if (d.absoluteDeviationTooLarge || d.perPaymentDeviationTooLarge) {
      console.log(
        `Deviation from expectation too large for ${address} and ${chainInfo.domain}:`,
      );
      console.log(JSON.stringify(d, null, 2));
      fs.writeFileSync(
        "./integration-tests/out-temp/portfolio-movements.json",
        JSON.stringify(portfolioMovements, null, 2),
      );
      expect(d.absoluteDeviationTooLarge).toBeFalsy();
      expect(d.perPaymentDeviationTooLarge).toBeFalsy();
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
