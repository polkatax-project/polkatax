process.env.LOG_LEVEL = "error";

import {
  startStubs,
  stopStubs,
} from "../shared/helper/fetch-portfolio-movements";
import { verifyPortfolioChanges } from "../shared/helper/verify-portfolio-changes";
import { getVerifyableChains } from "../shared/helper/get-verifyable-chains";
import { PortfolioMovementCorrectionService } from "../../src/server/data-correction/portfolio-movement-correction.service";
import { createDIContainer } from "../../src/server/di-container";
import { DeviationLimit } from "../../src/server/data-correction/model/deviation-limit";

const verifyWallets = async (
  wallets: (string | { address: string; excludeChains: string[] })[],
  deviationLimits: DeviationLimit[],
) => {
  const maxDate = new Date();
  const minDate = new Date("2024-01-01T00:00:00.000Z");
  maxDate.setDate(maxDate.getDate() - 30);
  for (let wallet of wallets) {
    const walletAddress = typeof wallet === "string" ? wallet : wallet.address;
    console.log(`Evaluating ${walletAddress}`);
    const chainsToSkip = typeof wallet === "string" ? [] : wallet.excludeChains;
    const chains = getVerifyableChains(walletAddress).filter(
      (c) => c.domain !== "alephzero" && c.domain !== "nodle",
    );
    for (let chain of chains) {
      if (chainsToSkip.includes(chain.domain)) {
        continue;
      }
      try {
        await verifyPortfolioChanges(
          walletAddress,
          chain,
          minDate.getTime(),
          maxDate.getTime(),
          deviationLimits,
        );
      } catch (error) {
        throw new Error(
          `Error evaluating ${wallet} and ${chain.domain}`,
          error,
        );
      }
    }
  }
};

const verifyPortfolioChangesOfTestWallets = async () => {
  console.log("🚀 Starting e2e test...");
  await startStubs();
  try {
    const container = createDIContainer();
    const portfolioMovementCorrectionService: PortfolioMovementCorrectionService =
      container.resolve("portfolioMovementCorrectionService");
    const deviationLimits =
      await portfolioMovementCorrectionService.determineAdequateMaxDeviations();

    const addresses: (string | { address: string; excludeChains: string[] })[] =
      [
       { address: "12YCxZBQVxvbcdRW66JTJ8ppEYg7JxXNCYqme3dMWKJJVdtf", excludeChains: ['hydration'] },
      "16mrcAndMguy3wqfuLNubgxxeyWQHjYAdqRbj26Vb2gYtszK",
      "1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y",
      "12NM61UnRNNQ1thxEpmUEZpQLq9wCGEhYvAmJwWvyaARja2r",
      "16JJyY72FpX6p8LBdqomZ6T6gRvNGY4fmLg8ASncBh5iecoW",
      "0x56F17ebFe6B126E9f196e7a87f74e9f026a27A1F", 
      { address: "16MicRbY5KkHP8oAehmHEfssM5h4t7sbVhGprqVxV3uV3Yc5", excludeChains: ['acala'] }, // -> Acala, evm log
      "15tZKWzhNFM1dpjKvjt4cYhZ9uJKyEZ6McrqwtYFwCVG8XUh",
      "17VdcY2F3WvhSLFHBGZreubzQNQ3NZzLbQsugGzHmzzprSG",
      "12s37eSMQPEN5cuVyBxk2UypUHntwumqBHy7sJkoKpZ1v3HV",
      "13qSxtKtr54qebSQzf1c7MC9CwkkZMMFaXyHKq8LzjSjiU3M",
      "15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB",
      "1CEZAcr7sGqC7Sx6jwWJ5JBALa8iqwS18kj3Y9RzmZacL33",
      "12GxfBTJEUTK1FpQpqtCLz5Rb2bU3YtG9CbzFnLcEqdagXfZ",
      "12gMhxHw8QjEwLQvnqsmMVY1z5gFa54vND74aMUbhhwN6mJR",
      "15uLbPqrwENdf8kqDxESH7RHQ2rTypjxPvkmWTyfn6rcwxLo",
      "15XS4LkFVqNfRHz9kFa2TtVkFN7h9Sv4TzpaoNuTQEfVWm4F",
      "15yhxUC89ULF3WxvH2P6r4ktWRPhF7r7LtXMaGGADoyVxs2B",
      "146FpXUf1GZyVUX5G1pwz7SsbqR9zcc62QaSaruanCjt6ChD",
      "129rZrLZG9MPWtiDN8Tc6empCdPsVJVjKGXidPWFmf1AKT89",
      "15ovWxBRypRPyNN4T9yEeB5T3G4xzhd2xVUw9jxkaQPKAVsb",
      "16MLAothZi5pE1ZcZZnBfAVer8h6CXTENnomThFuzi1pqPRa",
      "13f1iU967VsBeRxueqs9zrJV6JZ1EmEP6A1QTatThBcYbxqE",
      "1EA4xDSP5fBk8Ca3CLEdXSMDmsxMGVTdV7u5SFScWkNopkp",
      "13XsYw7tqxiujmGv9kZYzjKKNMpXzYMM7e9MM6fq9UKrMrqk",
      "13GEk517q2rDtrRKC1yormR2Aj5enhR9nkV1VwAygmxsf7vf",
      "15YVkRJDgNHzmxkUiLJWnjKCtCcCsiqpCVay9nLhF1hRKycS",
      "15uR1joy8ZXZyRtWh4e91T6hNaipG2i2qAvixfkAFQGe7X83",
      "126PvMw34oFYv5miwXQ3JXVP5eav8T1hkkYsiHijExJ4JorP",
        {
          address: "126PvMw34oFYv5miwXQ3JXVP5eav8T1hkkYsiHijExJ4JorP",
          excludeChains: ["heima"],
        },
      "12WGkKdAbWyksSMGXFNfXmhVTdcRfazeLx5qNg7mw7ThP9Zj",
      "15DE5wsjaXtFMu4vSy9aqovBm8NWmd3PGUziQPbSZWJmiASJ",
      "12WWjrZGuVxyk5AyFeDGaN45J1FJ6MesXRxhmY41rhKxL961",
      "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
      "1NUuRnRKayAxnswLiFFzdM1rzqyLGLEZ1Fr9ugecfV4hzyD",
      "0x7041617A1bFF5a973366340b03F6CD024470B7d1"
      ];

    await verifyWallets(addresses, deviationLimits);
    console.log(`✅ e2e test completed`);
  } finally {
    await stopStubs();
  }
};
verifyPortfolioChangesOfTestWallets();
