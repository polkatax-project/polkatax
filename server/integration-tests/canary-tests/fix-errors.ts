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
    fs.readFileSync("./logs/" + chain.domain + "-" + address + ".json", "utf-8"),
  );

  console.log("unmatched events " + unmatchedEvents.length)

  await portfolioMovementCorrectionService.fixErrorsAndMissingData(
    chain,
    address,
    portfolioMovements,
    unmatchedEvents,
    portfolioMovements.reduce(
      (mindate, p) => Math.min(mindate, p.timestamp),
      Number.MAX_SAFE_INTEGER,
    ),
    portfolioMovements.reduce(
      (maxdate, p) => Math.max(maxdate, p.timestamp),
      0,
    ),
  );
};

fixErrors("13zGzFdxkfYzYZVBoKEtnbGWkqJNHBCm4SvkVLLB7qbEXfqc", {
  domain: "hydration",
  token: "HDX",
});
