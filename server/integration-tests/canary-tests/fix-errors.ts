import dotenv from "dotenv";
import { envFile } from "../../src/server/env.config";
dotenv.config({ path: envFile });
import * as fs from "fs";
import { createDIContainer } from "../../src/server/di-container";
import { PortfolioMovementCorrectionService } from "../../src/server/data-correction/portfolio-movement-correction.service";
import {
  startStubs,
  stopStubs,
} from "../shared/helper/fetch-portfolio-movements";
import { CryptoCurrencyPricesService } from "../../src/server/data-aggregation/services/crypto-currency-prices.service";
import { cryptoCurrencyPricesServer } from "../../src/crypto-currency-prices/crypto-prices.server";
import { PortfolioMovementsService } from "../../src/server/data-aggregation/services/portfolio-movements.service";
import { SubscanService } from "../../src/server/blockchain/substrate/api/subscan.service";
import { extractXcmFees } from "../../src/server/data-aggregation/services/special-event-processing/extract-xcm-fees";

export const doSth = async () => {
  const cryptoPriceServer = await cryptoCurrencyPricesServer.init();

  const container = createDIContainer();
  const cryptoCurrencyPricesService: CryptoCurrencyPricesService =
    container.resolve("cryptoCurrencyPricesService");

  const data = await Promise.all([
    cryptoCurrencyPricesService.fetchHistoricalPrices("polkadot", "usd"),
    cryptoCurrencyPricesService.fetchHistoricalPrices("polkadot", "usd"),
    cryptoCurrencyPricesService.fetchHistoricalPrices("polkadot", "usd"),
    cryptoCurrencyPricesService.fetchHistoricalPrices("polkadot", "usd"),
  ]);

  await new Promise((resolve) => setTimeout(resolve, 5000));

  await cryptoCurrencyPricesService.fetchHistoricalPrices("polkadot", "usd");

  // await cryptoCurrencyPricesService.fetchHistoricalPrices('polkadot', 'usd')

  await cryptoPriceServer.close();
};

export const fixErrors = async (
  address: string,
  chain: { domain: string; token: string },
) => {
  const container = createDIContainer();
  const portfolioMovementsService: PortfolioMovementsService =
    container.resolve("portfolioMovementsService");

  await portfolioMovementsService.fetchPortfolioMovements({
    chain,
    address,
    currency: "usd",
    minDate: new Date("2024-01-01T00:00:00.000").getTime(),
    maxDate: new Date("2024-12-31T23:59:59.999").getTime(),
  });
};

export const extractXcmFeesTest = async (
  address: string,
  chain: { domain: string; token: string },
) => {
  const container = createDIContainer();
  const subscanService: SubscanService = container.resolve("subscanService");

  const extrinsicDetails = await subscanService.fetchExtrinsicDetails(
    chain.domain,
    ["27775704-2"],
  );
  const fees = extractXcmFees(address, extrinsicDetails[0]);
  console.log(fees);

  const extrinsicAHDetails = await subscanService.fetchExtrinsicDetails(
    "assethub-polkadot",
    ["9691752-2"],
  );
  const feesAH = extractXcmFees(
    "15x6pUbJwbQPBHfoyEp8pcESNroYVrDddst7iYSXr9v1wpHW",
    extrinsicAHDetails[0],
  );
  console.log(feesAH);

  const extrinsicHdxDetails = await subscanService.fetchExtrinsicDetails(
    "hydration",
    ["9230139-2"],
  );
  const feesHdx = extractXcmFees(
    "14VJdWHdzgXZKaLSqcFcvRYgdhZW4iK8KMuKDZRkT67D2BbK",
    extrinsicHdxDetails[0],
  );
  console.log(feesHdx);
};

extractXcmFeesTest("136qh3c7rp19qiB9NTfbxAR4rfnUUZDxh68cqMxyenncuw5y", {
  domain: "polkadot",
  token: "DOT",
});
/*
fixErrors("12WWjrZGuVxyk5AyFeDGaN45J1FJ6MesXRxhmY41rhKxL961", {
  domain: "polkadot",
  token: "DOT",
});

*/
