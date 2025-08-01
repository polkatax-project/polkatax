import { afterAll, beforeAll, describe, test } from "@jest/globals";
import { fetchPortfolioChangesExpectedVSActual } from "./verify-portfolio-difference";
import { startStubs, stopStubs } from "./helper/fetch-portfolio-movements";
import { waitForPortToBeFree } from "../e2e-tests/util/wait-for-port-to-be-free";

const acceptedDeviations = [
  {
    symbol: "DOT",
    perPayment: 0.5,
    max: 2,
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
    max: 1,
  },
  {
    symbol: "USDT",
    perPayment: 0.1,
    max: 1,
  },
  {
    symbol: "ASTR",
    perPayment: 1,
    max: 100,
  },
  {
    symbol: "HDX",
    perPayment: 3,
    max: 100,
  },
];

const verifyAssetMovement = async (
  address: string,
  chainInfo: { domain: string; label: string; token: string },
  options?: {
    toleranceOverride?: {
      symbol: string;
      perPayment: number;
      max: number;
    }[];
  },
) => {
  const today = new Date();
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - 7);
  const comparison = await fetchPortfolioChangesExpectedVSActual(
    address,
    chainInfo,
    pastDate.getTime(),
    false,
  );
  comparison.results.forEach((r) => {
    const acceptedDeviationsForToken = (options?.toleranceOverride ?? []).find(
      (t) => r.symbol.toUpperCase() === t.symbol,
    ) ??
      acceptedDeviations.find((t) => r.symbol.toUpperCase() === t.symbol) ?? {
        perPayment: 0.01,
        max: 0.1,
      };
    if (r.deviationPerPayment > acceptedDeviationsForToken.perPayment) {
      throw new Error("Deviation too large: " + JSON.stringify(r));
    }
    if (r.deviationAbs > acceptedDeviationsForToken.max) {
      throw new Error("Absolute Deviation too large: " + JSON.stringify(r));
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

    test("polkadot-1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", async () => {
      await verifyAssetMovement(
        "13qSxtKtr54qebSQzf1c7MC9CwkkZMMFaXyHKq8LzjSjiU3M",
        chainInfo,
      );
    });

    test("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", async () => {
      await verifyAssetMovement(
        "15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB",
        chainInfo,
      );
    });

    test("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", async () => {
      await verifyAssetMovement(
        "1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33",
        chainInfo,
      );
    });

    test("1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", async () => {
      await verifyAssetMovement(
        "1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change coretime", () => {
    const chainInfo = { domain: "coretime-polkadot", label: "", token: "DOT" };
    test("15fTH34bbKGMUjF1bLmTqxPYgpg481imThwhWcQfCyktyBzL", async () => {
      await verifyAssetMovement(
        "15fTH34bbKGMUjF1bLmTqxPYgpg481imThwhWcQfCyktyBzL",
        chainInfo,
      );
    });

    test("15mYsj6DpBno58jRoV5HCTiVPFBuWhDLdsWtq3LxwZrfaTEZ", async () => {
      await verifyAssetMovement(
        "15mYsj6DpBno58jRoV5HCTiVPFBuWhDLdsWtq3LxwZrfaTEZ",
        chainInfo,
      );
    });
    //test("15tkmix9R7ZRYGsLGV15mpZSbicPjmnhLdnUccAwfRi7RPVV", async () => {
    //  await verifyAssetMovement("15tkmix9R7ZRYGsLGV15mpZSbicPjmnhLdnUccAwfRi7RPVV", chainInfo)
    //}) very long...

    test("1HwQbUpcr99UA6W7WBK86RtMHJTBWRazpxuYfRHyhSCbE1j", async () => {
      await verifyAssetMovement(
        "1HwQbUpcr99UA6W7WBK86RtMHJTBWRazpxuYfRHyhSCbE1j",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change people-polkadot", () => {
    const chainInfo = { domain: "people-polkadot", label: "", token: "DOT" };

    test("16LviqDmEdn49UqeVSw3N1SjoJxRVV1EBbydbEqqaCvdtAsY", async () => {
      await verifyAssetMovement(
        "16LviqDmEdn49UqeVSw3N1SjoJxRVV1EBbydbEqqaCvdtAsY",
        chainInfo,
      );
    });

    test("142nFphK2qW4AWxZYFZiKjirKBMZPFRsCYDe75Rv9YSCkDUW", async () => {
      await verifyAssetMovement(
        "142nFphK2qW4AWxZYFZiKjirKBMZPFRsCYDe75Rv9YSCkDUW",
        chainInfo,
      );
    });

    test("14Gnp9cpb4mrXrpbCVNQSEPyL3QhoccGB9qpTRxqKWWMWSxn", async () => {
      await verifyAssetMovement(
        "14Gnp9cpb4mrXrpbCVNQSEPyL3QhoccGB9qpTRxqKWWMWSxn",
        chainInfo,
      );
    });
    test("15mYsj6DpBno58jRoV5HCTiVPFBuWhDLdsWtq3LxwZrfaTEZ", async () => {
      await verifyAssetMovement(
        "15mYsj6DpBno58jRoV5HCTiVPFBuWhDLdsWtq3LxwZrfaTEZ",
        chainInfo,
      );
    });

    test("12ryo7Fp21tKkFQWJ2vSVMY2BH3t9syk65FUaywraHLs3T4T", async () => {
      await verifyAssetMovement(
        "12ryo7Fp21tKkFQWJ2vSVMY2BH3t9syk65FUaywraHLs3T4T",
        chainInfo,
      );
    });

    test("12ryo7Fp21tKkFQWJ2vSVMY2BH3t9syk65FUaywraHLs3T4T", async () => {
      await verifyAssetMovement(
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
      await verifyAssetMovement(
        "1L66uQMKFnXKSZx9pCD5o56GvvP1i2Qns7CaS2AaKp9mnwc",
        chainInfo,
      );
    });

    test("168BAPzMCWtzvbUVAXjDcJjZCtog7tmoMN2kRa7nusoxJeB8", async () => {
      await verifyAssetMovement(
        "168BAPzMCWtzvbUVAXjDcJjZCtog7tmoMN2kRa7nusoxJeB8",
        chainInfo,
      );
    });

    test("12zsKEDVcHpKEWb99iFt3xrTCQQXZMu477nJQsTBBrof5k2h", async () => {
      await verifyAssetMovement(
        "12zsKEDVcHpKEWb99iFt3xrTCQQXZMu477nJQsTBBrof5k2h",
        chainInfo,
      );
    });

    test("14EQvBy9h8xGbh2R3ustnkfkF514E7wpmHtg27gDaTLM2str", async () => {
      await verifyAssetMovement(
        "14EQvBy9h8xGbh2R3ustnkfkF514E7wpmHtg27gDaTLM2str",
        chainInfo,
      );
    });

    test("13C7Ssy9QNJk515SFezaKMfhMRFrRcZWBhXA3oDq1AuKVds5", async () => {
      await verifyAssetMovement(
        "13C7Ssy9QNJk515SFezaKMfhMRFrRcZWBhXA3oDq1AuKVds5",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change Acala", () => {
    const chainInfo = { domain: "acala", label: "", token: "ACA" };

    test("1UA2r4UWyAJfWyCEb39oevsUxuzB8XeriJSsdzVtoLNzddr", async () => {
      await verifyAssetMovement(
        "1UA2r4UWyAJfWyCEb39oevsUxuzB8XeriJSsdzVtoLNzddr",
        chainInfo,
      );
    });

    test("1L66uQMKFnXKSZx9pCD5o56GvvP1i2Qns7CaS2AaKp9mnwc", async () => {
      await verifyAssetMovement(
        "1L66uQMKFnXKSZx9pCD5o56GvvP1i2Qns7CaS2AaKp9mnwc",
        chainInfo,
      );
    });

    test("13EXo5nS5kJMRHqghAcq1z3j3XpguLiWzvV8cbYSXXJsTBYy", async () => {
      await verifyAssetMovement(
        "13EXo5nS5kJMRHqghAcq1z3j3XpguLiWzvV8cbYSXXJsTBYy",
        chainInfo,
      );
    });

    test("1sdEj2dBvsGUQ2MqiZWJ8hHss7cCZ4nFcrjE6xDBCtPYiJx", async () => {
      await verifyAssetMovement(
        "1sdEj2dBvsGUQ2MqiZWJ8hHss7cCZ4nFcrjE6xDBCtPYiJx",
        chainInfo,
      );
    });
    test("1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33", async () => {
      await verifyAssetMovement(
        "1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33",
        chainInfo,
      );
    });
    test("1sdEj2dBvsGUQ2MqiZWJ8hHss7cCZ4nFcrjE6xDBCtPYiJx", async () => {
      await verifyAssetMovement(
        "1sdEj2dBvsGUQ2MqiZWJ8hHss7cCZ4nFcrjE6xDBCtPYiJx",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change astar", () => {
    const chainInfo = { domain: "astar", label: "", token: "ASTR" };

    test("13hDgWbatzrMmdPGz4F3Y63vP3qmdac7PUrujcN5a8nB6CkJ", async () => {
      await verifyAssetMovement(
        "13hDgWbatzrMmdPGz4F3Y63vP3qmdac7PUrujcN5a8nB6CkJ",
        chainInfo,
      );
    });
    test("15tH5VV82YwsJPBGcBFmGvgkiBCkAzcCXbZLbZ7TkCJM6kdq", async () => {
      await verifyAssetMovement(
        "15tH5VV82YwsJPBGcBFmGvgkiBCkAzcCXbZLbZ7TkCJM6kdq",
        chainInfo,
      );
    });
    test("16m3U19QHy39x5BBTR2FN9yh2k9LhUnS727N3wSH48P9wj8K", async () => {
      await verifyAssetMovement(
        "16m3U19QHy39x5BBTR2FN9yh2k9LhUnS727N3wSH48P9wj8K",
        chainInfo,
      );
    });
    test("153G4p8oHhKuVodS4pcQEgs23TrC9jfVueZ7npbL65JoFRYs", async () => {
      await verifyAssetMovement(
        "153G4p8oHhKuVodS4pcQEgs23TrC9jfVueZ7npbL65JoFRYs",
        chainInfo,
      );
    });
    // takes too long test("15yZzmbMsogqqxVNNfe6t4LaYmjGWbPFDbADo23voJSKvywq", async () => {
    //  await verifyAssetMovement("15yZzmbMsogqqxVNNfe6t4LaYmjGWbPFDbADo23voJSKvywq", chainInfo)
    //})
    // takes too long test("13AxCbvHff9d9LBtdNZBT5f2JoiHVRaHyiuUwZMmnBuGrSE8", async () => {
    // await verifyAssetMovement("13AxCbvHff9d9LBtdNZBT5f2JoiHVRaHyiuUwZMmnBuGrSE8", chainInfo)
    // }, 1200000)
  });

  describe("Verify the portfolio change mythos", () => {
    const chainInfo = { domain: "mythos", label: "", token: "MYTH" };
    test("0xf8683ecADdCb12891867CCDF4dbC96f47d62d67B", async () => {
      await verifyAssetMovement(
        "0xf8683ecADdCb12891867CCDF4dbC96f47d62d67B",
        chainInfo,
      );
    });
    // test failes: test("0x5EE06FECF52b12c66b03700821FbBc9dD5680361", async () => {
    //  await verifyAssetMovement("0x5EE06FECF52b12c66b03700821FbBc9dD5680361", chainInfo)
    // })
    // long running test("0xF6eAAdC72D1a58F735965EA196E4FA7029fC76dC", async () => {
    //  await verifyAssetMovement("0xF6eAAdC72D1a58F735965EA196E4FA7029fC76dC", chainInfo)
    //})
  });

  describe("Verify the portfolio change energywebx", () => {
    const chainInfo = { domain: "energywebx", label: "", token: "EWT" };
    test("13KemmTsLpdz8sbdB8cL4Lw3PDVgy2UjEnayx72QgUbAcSRT", async () => {
      await verifyAssetMovement(
        "13KemmTsLpdz8sbdB8cL4Lw3PDVgy2UjEnayx72QgUbAcSRT",
        chainInfo,
      );
    });
    test("16dCndCe1hUGuqFNiBQdvmXtWTRN6MSf9s5wjiEkxTsBo5Jb", async () => {
      await verifyAssetMovement(
        "16dCndCe1hUGuqFNiBQdvmXtWTRN6MSf9s5wjiEkxTsBo5Jb",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change neuroweb", () => {
    const chainInfo = { domain: "neuroweb", label: "", token: "NEURO" };

    test("16MRsnWMXvBiHK8FUu9GMNBaVFbY9RpVcCWbviRjL1ogGWQ7", async () => {
      await verifyAssetMovement(
        "16MRsnWMXvBiHK8FUu9GMNBaVFbY9RpVcCWbviRjL1ogGWQ7",
        chainInfo,
      );
    });

    test("15gPguU3rf2CdWwqahgc3HYk6R9bw5HSdDqYxoNyG9Enrc5V", async () => {
      await verifyAssetMovement(
        "15gPguU3rf2CdWwqahgc3HYk6R9bw5HSdDqYxoNyG9Enrc5V",
        chainInfo,
      );
    });

    test("14BSK3tU1iqT7U2UfdZGsQ7duLRUBXK6W4sUTUd5J7DQPoNz", async () => {
      await verifyAssetMovement(
        "14BSK3tU1iqT7U2UfdZGsQ7duLRUBXK6W4sUTUd5J7DQPoNz",
        chainInfo,
      );
    });
    test("12pGnMsHHe4cUVTnBpXEhxyfL59zcDSEk4xLA9EgYFUgS6Uq", async () => {
      await verifyAssetMovement(
        "12pGnMsHHe4cUVTnBpXEhxyfL59zcDSEk4xLA9EgYFUgS6Uq",
        chainInfo,
      );
    });
  });

  describe("Verify the portfolio change hydration", () => {
    const chainInfo = { domain: "hydration", label: "", token: "HDX" };

    test("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", async () => {
      await verifyAssetMovement(
        "15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB",
        chainInfo,
      );
    });

    test("131d4YS25qpuXiHrfJibuFYXwZrzwxpvU1ahvr3TJFNYcmfk", async () => {
      await verifyAssetMovement(
        "131d4YS25qpuXiHrfJibuFYXwZrzwxpvU1ahvr3TJFNYcmfk",
        chainInfo,
      );
    });
  });
});
