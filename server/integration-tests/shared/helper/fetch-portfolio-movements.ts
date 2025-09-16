import { FastifyInstance } from "fastify";
import { startStub as cryptoPricesStub } from "../../../src/crypto-currency-prices/stub";
import { startStub as fiatPricesStub } from "../../../src/fiat-exchange-rates/stub";
import { SubscanEvent } from "../../../src/server/blockchain/substrate/model/subscan-event";
import { PortfolioMovement } from "../../../src/server/data-aggregation/model/portfolio-movement";
import { createDIContainer } from "../../../src/server/di-container";
import { PortfolioMovementsService } from "../../../src/server/data-aggregation/services/portfolio-movements.service";

let cryptoPriceServer: FastifyInstance;
let fiatPriceServer: FastifyInstance;

export const startStubs = async () => {
  cryptoPriceServer = await cryptoPricesStub();
  fiatPriceServer = await fiatPricesStub();
};

export const stopStubs = async () => {
  await fiatPriceServer?.close();
  await cryptoPriceServer?.close();
};

export const fetchPortfolioMovements = async (
  address: string,
  chain: { domain: string; label: string; token: string },
  minDate?: number,
  maxDate?: number,
): Promise<{
  portfolioMovements: PortfolioMovement[];
  minBlock?: number;
  maxBlock?: number;
}> => {
  const container = createDIContainer();
  try {
    const currency = "usd";
    const portfolioMovementsService: PortfolioMovementsService =
      container.resolve("portfolioMovementsService");
    let { portfolioMovements } =
      (await portfolioMovementsService.fetchPortfolioMovements({
        chain,
        address,
        currency,
        minDate,
        maxDate,
      })) as {
        portfolioMovements: PortfolioMovement[];
      };
    if (portfolioMovements.length === 0) {
      return { portfolioMovements: [] };
    }
    const minBlock = portfolioMovements.reduce(
      (curr, next) => Math.min(curr, next.block ?? Number.MAX_SAFE_INTEGER),
      Number.MAX_SAFE_INTEGER,
    );
    const maxBlock = portfolioMovements.reduce(
      (curr, next) => Math.max(curr, next.block ?? 0),
      0,
    );
    return { portfolioMovements, minBlock, maxBlock };
  } catch (error) {
    console.log(error);
  }
};
