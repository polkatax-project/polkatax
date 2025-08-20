import { afterAll, beforeAll, describe, test } from "@jest/globals";
import {
  startStubs,
  stopStubs,
} from "../shared/helper/fetch-portfolio-movements";
import { waitForPortToBeFree } from "../shared/helper/wait-for-port-to-be-free";
import { verifyPortfolioDifference } from "../shared/verify-portfolio-difference";

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
  options: {
    useFees?: boolean;
  } = {},
) => {
  const minDate = new Date(
    `${new Date().getFullYear() - 1}-10-01T00:00:00.000Z`,
  );
  const maxDate = new Date(
    `${new Date().getFullYear() - 1}-12-31T00:00:00.000Z`,
  );
  await verifyPortfolioDifference(
    address,
    chainInfo,
    minDate.getTime(),
    maxDate.getTime(),
    { acceptedDeviations, ...options },
  );
};

beforeAll(async () => {
  await startStubs();
});

afterAll(async () => {
  await stopStubs();
  await waitForPortToBeFree(3003);
  await waitForPortToBeFree(3002);
});

describe.skip("Verify portfolio changes", () => {
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
        { useFees: true },
      );
    }, 600000);
  });

  describe("Verify the portfolio change people-polkadot", () => {
    const chainInfo = { domain: "people-polkadot", label: "", token: "DOT" };

    test("16LviqDmEdn49UqeVSw3N1SjoJxRVV1EBbydbEqqaCvdtAsY", async () => {
      await verifyPortfolioChanges(
        "16LviqDmEdn49UqeVSw3N1SjoJxRVV1EBbydbEqqaCvdtAsY",
        chainInfo,
        { useFees: true },
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
        { useFees: true },
      );
    }, 600000);
  });

  describe("Verify the portfolio change Acala", () => {
    const chainInfo = { domain: "acala", label: "", token: "ACA" };

    test("1UA2r4UWyAJfWyCEb39oevsUxuzB8XeriJSsdzVtoLNzddr", async () => {
      await verifyPortfolioChanges(
        "1UA2r4UWyAJfWyCEb39oevsUxuzB8XeriJSsdzVtoLNzddr",
        chainInfo,
        { useFees: true },
      );
    }, 600000);
  });

  describe("Verify the portfolio change astar", () => {
    const chainInfo = { domain: "astar", label: "", token: "ASTR" };

    test("13hDgWbatzrMmdPGz4F3Y63vP3qmdac7PUrujcN5a8nB6CkJ", async () => {
      await verifyPortfolioChanges(
        "13hDgWbatzrMmdPGz4F3Y63vP3qmdac7PUrujcN5a8nB6CkJ",
        chainInfo,
        { useFees: true },
      );
    }, 600000);
  });

  describe("Verify the portfolio change hydration", () => {
    const chainInfo = { domain: "hydration", label: "", token: "HDX" };

    test("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", async () => {
      await verifyPortfolioChanges(
        "15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB",
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
        { useFees: true },
      );
    }, 600000);
  });
});
