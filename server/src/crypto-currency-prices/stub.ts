import Fastify, { FastifyInstance, FastifyRequest } from "fastify";
import { logger } from "./logger/logger";
import dotenv from "dotenv";
dotenv.config({ path: __dirname + "/../../.env" });
import { CurrencyQuotes } from "../model/crypto-currency-prices/crypto-currency-quotes";

const createHistoricMockdata = (currency): CurrencyQuotes => {
  const result: CurrencyQuotes = {
    currency,
    quotes: { timestamp: Date.now() },
  };
  const now = new Date();
  const startDate = new Date(now);
  startDate.setFullYear(now.getFullYear() - 10);
  startDate.setMonth(0);
  startDate.setDate(0);

  startDate.setUTCHours(0, 0, 0, 0);
  for (
    let date = new Date(startDate);
    date <= now;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    result.quotes[date.toISOString().split("T")[0]] = 10.0;
  }
  return result;
};

export const startStub = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    loggerInstance: logger,
  });

  fastify.route({
    method: "GET",
    url: "/crypto-historic-prices/:tokenId",
    handler: async (
      request: FastifyRequest<{
        Params: { tokenId: string };
        Querystring: { currency: string };
      }>,
    ) => {
      const { currency } = request.query;
      return createHistoricMockdata(currency);
    },
  });

  fastify.listen(
    { port: Number(process.env["CRYPTO_CURRENCY_PRICES_PORT"] || 3003) },
    (err) => {
      if (err) {
        fastify.log.error(err);
        process.exit(1);
      }
    },
  );
  return fastify;
};
