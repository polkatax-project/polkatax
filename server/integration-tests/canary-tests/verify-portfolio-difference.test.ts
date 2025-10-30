import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import {
  startStubs,
  stopStubs,
} from "../shared/helper/fetch-portfolio-movements";
import { waitForPortToBeFree } from "../shared/helper/wait-for-port-to-be-free";
import { createDIContainer } from "../../src/server/di-container";
import { PortfolioMovement } from "../../src/server/data-aggregation/model/portfolio-movement";
import { PortfolioMovementsService } from "../../src/server/data-aggregation/services/portfolio-movements.service";
import { PortfolioChangeValidationService } from "../../src/server/data-correction/portfolio-change-validation.service";

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

  const today = new Date();
  const minDate = new Date();
  minDate.setDate(today.getDate() - 14);

  let { portfolioMovements } =
    (await portfolioMovementsService.fetchPortfolioMovements({
      chain: chainInfo,
      address: address,
      currency: "USD",
      maxDate: Date.now(),
      minDate: minDate.getTime(),
    })) as {
      portfolioMovements: PortfolioMovement[];
    };

  if (portfolioMovements.length === 0) {
    return;
  }

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
  deviations.forEach((d) => {
    if (d.absoluteDeviationTooLarge) {
      console.log(
        `Deviation from expectation too large for ${address} and ${chainInfo.domain}:`,
      );
      console.log(JSON.stringify(d, null, 2));
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

describe.skip("Verify portfolio changes", () => {
  describe("Verify the portfolio change assethub polkadot", () => {
    const chainInfo = { domain: "assethub-polkadot", label: "", token: "DOT" };

    test("12NM61UnRNNQ1thxEpmUEZpQLq9wCGEhYvAmJwWvyaARja2r", async () => {
      await verifyPortfolioChanges(
        "12NM61UnRNNQ1thxEpmUEZpQLq9wCGEhYvAmJwWvyaARja2r",
        chainInfo,
      );
    });

    test("13qSxtKtr54qebSQzf1c7MC9CwkkZMMFaXyHKq8LzjSjiU3M", async () => {
      await verifyPortfolioChanges(
        "12NM61UnRNNQ1thxEpmUEZpQLq9wCGEhYvAmJwWvyaARja2r",
        chainInfo,
      );
    });

    test("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", async () => {
      await verifyPortfolioChanges(
        "15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB",
        chainInfo,
      );
    });

    test("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", async () => {
      await verifyPortfolioChanges(
        "1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33",
        chainInfo,
      );
    });

    test("1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", async () => {
      await verifyPortfolioChanges(
        "1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y",
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
    });

    test("15mYsj6DpBno58jRoV5HCTiVPFBuWhDLdsWtq3LxwZrfaTEZ", async () => {
      await verifyPortfolioChanges(
        "15mYsj6DpBno58jRoV5HCTiVPFBuWhDLdsWtq3LxwZrfaTEZ",
        chainInfo,
      );
    });

    test("1HwQbUpcr99UA6W7WBK86RtMHJTBWRazpxuYfRHyhSCbE1j", async () => {
      await verifyPortfolioChanges(
        "1HwQbUpcr99UA6W7WBK86RtMHJTBWRazpxuYfRHyhSCbE1j",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change people-polkadot", () => {
    const chainInfo = { domain: "people-polkadot", label: "", token: "DOT" };

    test("16LviqDmEdn49UqeVSw3N1SjoJxRVV1EBbydbEqqaCvdtAsY", async () => {
      await verifyPortfolioChanges(
        "16LviqDmEdn49UqeVSw3N1SjoJxRVV1EBbydbEqqaCvdtAsY",
        chainInfo,
      );
    });

    test("142nFphK2qW4AWxZYFZiKjirKBMZPFRsCYDe75Rv9YSCkDUW", async () => {
      await verifyPortfolioChanges(
        "142nFphK2qW4AWxZYFZiKjirKBMZPFRsCYDe75Rv9YSCkDUW",
        chainInfo,
      );
    });

    test("14Gnp9cpb4mrXrpbCVNQSEPyL3QhoccGB9qpTRxqKWWMWSxn", async () => {
      await verifyPortfolioChanges(
        "14Gnp9cpb4mrXrpbCVNQSEPyL3QhoccGB9qpTRxqKWWMWSxn",
        chainInfo,
      );
    });
    test("15mYsj6DpBno58jRoV5HCTiVPFBuWhDLdsWtq3LxwZrfaTEZ", async () => {
      await verifyPortfolioChanges(
        "15mYsj6DpBno58jRoV5HCTiVPFBuWhDLdsWtq3LxwZrfaTEZ",
        chainInfo,
      );
    });

    test("12ryo7Fp21tKkFQWJ2vSVMY2BH3t9syk65FUaywraHLs3T4T", async () => {
      await verifyPortfolioChanges(
        "12ryo7Fp21tKkFQWJ2vSVMY2BH3t9syk65FUaywraHLs3T4T",
        chainInfo,
      );
    });

    test("12ryo7Fp21tKkFQWJ2vSVMY2BH3t9syk65FUaywraHLs3T4T", async () => {
      await verifyPortfolioChanges(
        "12ryo7Fp21tKkFQWJ2vSVMY2BH3t9syk65FUaywraHLs3T4T",
        chainInfo,
      );
    });
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
    });

    test("168BAPzMCWtzvbUVAXjDcJjZCtog7tmoMN2kRa7nusoxJeB8", async () => {
      await verifyPortfolioChanges(
        "168BAPzMCWtzvbUVAXjDcJjZCtog7tmoMN2kRa7nusoxJeB8",
        chainInfo,
      );
    });

    test("12zsKEDVcHpKEWb99iFt3xrTCQQXZMu477nJQsTBBrof5k2h", async () => {
      await verifyPortfolioChanges(
        "12zsKEDVcHpKEWb99iFt3xrTCQQXZMu477nJQsTBBrof5k2h",
        chainInfo,
      );
    });

    test("14EQvBy9h8xGbh2R3ustnkfkF514E7wpmHtg27gDaTLM2str", async () => {
      await verifyPortfolioChanges(
        "14EQvBy9h8xGbh2R3ustnkfkF514E7wpmHtg27gDaTLM2str",
        chainInfo,
      );
    });

    test("13C7Ssy9QNJk515SFezaKMfhMRFrRcZWBhXA3oDq1AuKVds5", async () => {
      await verifyPortfolioChanges(
        "13C7Ssy9QNJk515SFezaKMfhMRFrRcZWBhXA3oDq1AuKVds5",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change Acala", () => {
    const chainInfo = { domain: "acala", label: "", token: "ACA" };

    test("1UA2r4UWyAJfWyCEb39oevsUxuzB8XeriJSsdzVtoLNzddr", async () => {
      await verifyPortfolioChanges(
        "1UA2r4UWyAJfWyCEb39oevsUxuzB8XeriJSsdzVtoLNzddr",
        chainInfo,
      );
    });

    test("1L66uQMKFnXKSZx9pCD5o56GvvP1i2Qns7CaS2AaKp9mnwc", async () => {
      await verifyPortfolioChanges(
        "1L66uQMKFnXKSZx9pCD5o56GvvP1i2Qns7CaS2AaKp9mnwc",
        chainInfo,
      );
    });

    test("13EXo5nS5kJMRHqghAcq1z3j3XpguLiWzvV8cbYSXXJsTBYy", async () => {
      await verifyPortfolioChanges(
        "13EXo5nS5kJMRHqghAcq1z3j3XpguLiWzvV8cbYSXXJsTBYy",
        chainInfo,
      );
    });

    test("1sdEj2dBvsGUQ2MqiZWJ8hHss7cCZ4nFcrjE6xDBCtPYiJx", async () => {
      await verifyPortfolioChanges(
        "1sdEj2dBvsGUQ2MqiZWJ8hHss7cCZ4nFcrjE6xDBCtPYiJx",
        chainInfo,
      );
    });
    test("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", async () => {
      await verifyPortfolioChanges(
        "1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33",
        chainInfo,
      );
    });
    test("1sdEj2dBvsGUQ2MqiZWJ8hHss7cCZ4nFcrjE6xDBCtPYiJx", async () => {
      await verifyPortfolioChanges(
        "1sdEj2dBvsGUQ2MqiZWJ8hHss7cCZ4nFcrjE6xDBCtPYiJx",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change astar", () => {
    const chainInfo = { domain: "astar", label: "", token: "ASTR" };

    test("13hDgWbatzrMmdPGz4F3Y63vP3qmdac7PUrujcN5a8nB6CkJ", async () => {
      await verifyPortfolioChanges(
        "13hDgWbatzrMmdPGz4F3Y63vP3qmdac7PUrujcN5a8nB6CkJ",
        chainInfo,
      );
    });
    test("15tH5VV82YwsJPBGcBFmGvgkiBCkAzcCXbZLbZ7TkCJM6kdq", async () => {
      await verifyPortfolioChanges(
        "15tH5VV82YwsJPBGcBFmGvgkiBCkAzcCXbZLbZ7TkCJM6kdq",
        chainInfo,
      );
    });
    test("16m3U19QHy39x5BBTR2FN9yh2k9LhUnS727N3wSH48P9wj8K", async () => {
      await verifyPortfolioChanges(
        "16m3U19QHy39x5BBTR2FN9yh2k9LhUnS727N3wSH48P9wj8K",
        chainInfo,
      );
    });
    test("153G4p8oHhKuVodS4pcQEgs23TrC9jfVueZ7npbL65JoFRYs", async () => {
      await verifyPortfolioChanges(
        "153G4p8oHhKuVodS4pcQEgs23TrC9jfVueZ7npbL65JoFRYs",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change mythos", () => {
    const chainInfo = { domain: "mythos", label: "", token: "MYTH" };
    test("0xf8683ecADdCb12891867CCDF4dbC96f47d62d67B", async () => {
      await verifyPortfolioChanges(
        "0xf8683ecADdCb12891867CCDF4dbC96f47d62d67B",
        chainInfo,
      );
    });
    test("0x5EE06FECF52b12c66b03700821FbBc9dD5680361", async () => {
      await verifyPortfolioChanges(
        "0x5EE06FECF52b12c66b03700821FbBc9dD5680361",
        chainInfo,
      );
    });
    test("0xF6eAAdC72D1a58F735965EA196E4FA7029fC76dC", async () => {
      await verifyPortfolioChanges(
        "0xF6eAAdC72D1a58F735965EA196E4FA7029fC76dC",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change energywebx", () => {
    const chainInfo = { domain: "energywebx", label: "", token: "EWT" };
    test("13KemmTsLpdz8sbdB8cL4Lw3PDVgy2UjEnayx72QgUbAcSRT", async () => {
      await verifyPortfolioChanges(
        "13KemmTsLpdz8sbdB8cL4Lw3PDVgy2UjEnayx72QgUbAcSRT",
        chainInfo,
      );
    });
    test("16dCndCe1hUGuqFNiBQdvmXtWTRN6MSf9s5wjiEkxTsBo5Jb", async () => {
      await verifyPortfolioChanges(
        "16dCndCe1hUGuqFNiBQdvmXtWTRN6MSf9s5wjiEkxTsBo5Jb",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change neuroweb", () => {
    const chainInfo = { domain: "neuroweb", label: "", token: "NEURO" };

    test("16MRsnWMXvBiHK8FUu9GMNBaVFbY9RpVcCWbviRjL1ogGWQ7", async () => {
      await verifyPortfolioChanges(
        "16MRsnWMXvBiHK8FUu9GMNBaVFbY9RpVcCWbviRjL1ogGWQ7",
        chainInfo,
      );
    });

    test("15gPguU3rf2CdWwqahgc3HYk6R9bw5HSdDqYxoNyG9Enrc5V", async () => {
      await verifyPortfolioChanges(
        "15gPguU3rf2CdWwqahgc3HYk6R9bw5HSdDqYxoNyG9Enrc5V",
        chainInfo,
      );
    });

    test("14BSK3tU1iqT7U2UfdZGsQ7duLRUBXK6W4sUTUd5J7DQPoNz", async () => {
      await verifyPortfolioChanges(
        "14BSK3tU1iqT7U2UfdZGsQ7duLRUBXK6W4sUTUd5J7DQPoNz",
        chainInfo,
      );
    });
    test("12pGnMsHHe4cUVTnBpXEhxyfL59zcDSEk4xLA9EgYFUgS6Uq", async () => {
      await verifyPortfolioChanges(
        "12pGnMsHHe4cUVTnBpXEhxyfL59zcDSEk4xLA9EgYFUgS6Uq",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change hydration", () => {
    const chainInfo = { domain: "hydration", label: "", token: "HDX" };

    test("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", async () => {
      await verifyPortfolioChanges(
        "15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB",
        chainInfo,
      );
    });

    test("14wDEEnVKZDXVXq2arAmkf1QmnTcwN4fzNJRFoM77YvFxa8T", async () => {
      await verifyPortfolioChanges(
        "14wDEEnVKZDXVXq2arAmkf1QmnTcwN4fzNJRFoM77YvFxa8T",
        chainInfo,
      );
    });

    test("15Vut6ZxJNKSCJY87DLtZZbFyWyR1LBwXhAc7wqwVRK3ioWN", async () => {
      await verifyPortfolioChanges(
        "15Vut6ZxJNKSCJY87DLtZZbFyWyR1LBwXhAc7wqwVRK3ioWN",
        chainInfo,
      );
    });

    test("13EXvi5s43SiCTih7twG6zr1xP7CbSp3pz5fYKiyscYQay6M", async () => {
      await verifyPortfolioChanges(
        "13EXvi5s43SiCTih7twG6zr1xP7CbSp3pz5fYKiyscYQay6M",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change phala", () => {
    const chainInfo = { domain: "phala", label: "", token: "PHA" };
    test("14EAEgGrbX3KCgyjBZRyB5qgYpuFHLB5AC8TX7hYLPRT1YPN", async () => {
      await verifyPortfolioChanges(
        "14EAEgGrbX3KCgyjBZRyB5qgYpuFHLB5AC8TX7hYLPRT1YPN",
        chainInfo,
      );
    });
    test("1bMaUv5vuzYsbYfhn2sUZ2LMYKHmfzF462PuwVtcqLC7rjN", async () => {
      await verifyPortfolioChanges(
        "1bMaUv5vuzYsbYfhn2sUZ2LMYKHmfzF462PuwVtcqLC7rjN",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change manta", () => {
    const chainInfo = { domain: "manta", label: "", token: "MANTA" };
    test("13ziS42MVCDz1biV4CdYUyBFLSYBKAfN6wBAf6nghe1hp7EQ", async () => {
      await verifyPortfolioChanges(
        "13ziS42MVCDz1biV4CdYUyBFLSYBKAfN6wBAf6nghe1hp7EQ",
        chainInfo,
      );
    });

    test("14V1m9Gxr2EEJpNDgvCrJ1HjSRCiFirChPKG6aBQJEyjeHDz", async () => {
      await verifyPortfolioChanges(
        "14V1m9Gxr2EEJpNDgvCrJ1HjSRCiFirChPKG6aBQJEyjeHDz",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change aleph zero", () => {
    const chainInfo = { domain: "alephzero", label: "", token: "AZERO" };
    test("1EfV7cA9FhgQSZQc3M5Ub5pxYdXjG6j8WUZarWe9ebRn7wd", async () => {
      await verifyPortfolioChanges(
        "1EfV7cA9FhgQSZQc3M5Ub5pxYdXjG6j8WUZarWe9ebRn7wd",
        chainInfo,
      );
    });

    test("13igYjrX45pYDFvcVN2CRmonJ7tm6YptjPLUffJ5efakzCkC", async () => {
      await verifyPortfolioChanges(
        "13igYjrX45pYDFvcVN2CRmonJ7tm6YptjPLUffJ5efakzCkC",
        chainInfo,
      );
    });
  });

  /**
   * Deactivated for now because on CI there's no access to the data platform API
   * Only works if USE_DATA_PLATFORM_API=true
   */
  describe.skip("Verify the portfolio change bifrost", () => {
    const chainInfo = { domain: "bifrost", label: "", token: "BNC" };
    test("16Zob7g9gBt1v8xz1SkUQPVoEL1sgbzSRE48EsK5CRCyYECx", async () => {
      await verifyPortfolioChanges(
        "16Zob7g9gBt1v8xz1SkUQPVoEL1sgbzSRE48EsK5CRCyYECx",
        chainInfo,
      );
    });

    test("1Zn6CU4CCHLDtrgxGsKYt65Ujd1vc72ydAxL5cUpymGHZoF", async () => {
      await verifyPortfolioChanges(
        "1Zn6CU4CCHLDtrgxGsKYt65Ujd1vc72ydAxL5cUpymGHZoF",
        chainInfo,
      );
    });

    test("12ERmt2RB2nJm9VTVf9BNNJXCf8cgSCvqYaGvqbscVo9E8tF", async () => {
      await verifyPortfolioChanges(
        "12ERmt2RB2nJm9VTVf9BNNJXCf8cgSCvqYaGvqbscVo9E8tF",
        chainInfo,
      );
    });

    test("123ZosSkquArbSaEDwkhFscTAwuJQRYvhS9EqBjGvKCTxbA8", async () => {
      await verifyPortfolioChanges(
        "123ZosSkquArbSaEDwkhFscTAwuJQRYvhS9EqBjGvKCTxbA8",
        chainInfo,
      );
    });
  });
});
