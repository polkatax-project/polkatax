import { FastifyInstance } from "fastify";
import { startStub as cryptoPricesStub } from "../../src/crypto-currency-prices/stub";
import { startStub as fiatPricesStub } from "../../src/fiat-exchange-rates/stub";
import { SubscanEvent } from "../../src/server/blockchain/substrate/model/subscan-event";
import { PortfolioMovement } from "../../src/server/data-aggregation/model/portfolio-movement";
import { PortfolioMovementsService } from "../../src/server/data-aggregation/services/portfolio-movements.service";
import { createDIContainer } from "../../src/server/di-container";

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
): Promise<{
  portfolioMovements: PortfolioMovement[];
  unmatchedEvents?: SubscanEvent[];
  minBlock?: number;
  maxBlock?: number;
}> => {
  const container = createDIContainer();
  try {
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 14);

    const currency = "usd";
    const portfolioMovementsService: PortfolioMovementsService =
      container.resolve("portfolioMovementsService");
    const { portfolioMovements, unmatchedEvents } =
      (await portfolioMovementsService.fetchPortfolioMovements({
        chain,
        address,
        currency,
        minDate: minDate ?? pastDate.getTime(),
      })) as {
        portfolioMovements: PortfolioMovement[];
        unmatchedEvents: SubscanEvent[];
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
    return { portfolioMovements, unmatchedEvents, minBlock, maxBlock };
  } catch (error) {
    console.log(error);
  }
};
