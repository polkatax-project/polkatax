import { FastifyInstance } from "fastify";
import { startStub as cryptoPricesStub } from "../../../src/crypto-currency-prices/stub";
import { startStub as fiatPricesStub } from "../../../src/fiat-exchange-rates/stub";
import { PortfolioMovement } from "../../../src/server/data-aggregation/model/portfolio-movement";
import { createDIContainer } from "../../../src/server/di-container";
import { PortfolioMovementsService } from "../../../src/server/data-aggregation/services/portfolio-movements.service";
import { determineMinMaxBlock } from "../../../src/server/data-aggregation/helper/determine-min-max-block";
import { BlockTimeService } from "../../../src/server/blockchain/substrate/services/block-time.service";

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
  chain: { domain: string; token: string },
  minDate?: number,
  maxDate?: number,
): Promise<{
  portfolioMovements: PortfolioMovement[];
  blockMin?: number;
  blockMax?: number;
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

    const blockTimeService: BlockTimeService =
      container.resolve("blockTimeService");
    const { blockMin, blockMax } = await determineMinMaxBlock(
      chain,
      portfolioMovements,
      minDate,
      maxDate,
      blockTimeService,
    );

    return { portfolioMovements, blockMin, blockMax };
  } catch (error) {
    console.log(error);
  }
};
