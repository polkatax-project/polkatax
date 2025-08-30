import dotenv from "dotenv";
import { envFile } from "../../src/server/env.config";
dotenv.config({ path: envFile });
import * as fs from "fs";
import { createDIContainer } from "../../src/server/di-container";
import { PortfolioMovementCorrectionService } from "../../src/server/data-correction/portfolio-movement-correction.service";

export const fixErrors = async (
  address: string,
  chain: { domain: string; token: string },
) => {
  const container = createDIContainer();
  const portfolioMovementCorrectionService: PortfolioMovementCorrectionService =
    container.resolve("portfolioMovementCorrectionService");

  const { portfolioMovements, unmatchedEvents } = JSON.parse(
    fs.readFileSync("./" + address + "_" + chain.domain + ".json", "utf-8"),
  );

  await portfolioMovementCorrectionService.fixErrorsAndMissingData(
    chain,
    address,
    portfolioMovements,
    unmatchedEvents,
  );

  fs.writeFileSync(
    "./fixed_fixed_" + address + "_" + chain.domain + ".json",
    JSON.stringify({ portfolioMovements, unmatchedEvents }, null, 2),
  );
};

fixErrors("1cCx8RqeaTJohgaGtPyJq8QFfc7Gi9tLU1bynC1TC9c9hNH", {
  domain: "hydration",
  token: "DOT",
});
