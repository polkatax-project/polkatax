import { formatDate } from "../../../common/util/date-utils";
import {
  CurrencyQuotes,
  Quotes,
} from "../../../model/crypto-currency-prices/crypto-currency-quotes";
import { logger } from "../../logger/logger";
import { convertFiatValues } from "../helper/convert-fiat-values";
import { findCoingeckoIdForNativeToken } from "../helper/find-coingecko-id-for-native-token";
import { PortfolioMovement } from "../model/portfolio-movement";
import { CryptoCurrencyPricesService } from "./crypto-currency-prices.service";
import { FiatExchangeRateService } from "./fiat-exchange-rate.service";
import * as subscanChains from "../../../../res/gen/subscan-chains.json";
import * as fs from "fs";

export interface CurrencyQuotesWToken {
  currency: string;
  quotes: Quotes;
  coingeckoId: string;
}

export class AddFiatValuesToTaxableEventsService {
  constructor(
    private cryptoCurrencyPricesService: CryptoCurrencyPricesService,
    private fiatExchangeRateService: FiatExchangeRateService,
  ) {}

  addFiatValuesToTaxableEvents(
    taxableEvents: PortfolioMovement[],
    quotes: Record<string, CurrencyQuotes>,
  ): PortfolioMovement[] {
    for (let taxable of taxableEvents as PortfolioMovement[]) {
      const isoDate = formatDate(new Date(taxable.timestamp));
      for (const transfer of taxable.transfers) {
        const tokenId = transfer.asset_unique_id;
        if (quotes[tokenId]?.quotes?.[isoDate]) {
          transfer.fiatValue =
            transfer.fiatValue ||
            transfer.amount * quotes[tokenId]?.quotes?.[isoDate];
          transfer.price = transfer.price || quotes[tokenId]?.quotes?.[isoDate];
        }
      }
    }
    return taxableEvents;
  }

  addFiatValuesForTxFees(
    taxableEvents: PortfolioMovement[],
    quotes: Record<string, CurrencyQuotes>,
  ): PortfolioMovement[] {
    for (let taxable of taxableEvents as PortfolioMovement[]) {
      const isoDate = formatDate(new Date(taxable.timestamp));
      const feeTokenId = taxable.feeTokenUniqueId;
      if (quotes[feeTokenId]?.quotes?.[isoDate]) {
        taxable.feeUsedFiat = taxable.feeUsed
          ? taxable.feeUsed * quotes[feeTokenId]?.quotes?.[isoDate]
          : undefined;
        taxable.tipFiat = taxable.tip
          ? taxable.tip * quotes[feeTokenId]?.quotes?.[isoDate]
          : undefined;
      }
    }
    return taxableEvents;
  }

  private async fetchQuotes(
    coingeckoIdMappings: Record<string, string>,
    currency: string,
  ): Promise<Record<string, CurrencyQuotes>> {
    const quotesList = await Promise.all([
      ...Object.keys(coingeckoIdMappings).map(async (coingeckoId) => {
        try {
          const quotes =
            (await this.cryptoCurrencyPricesService.fetchHistoricalPrices(
              coingeckoId,
              currency,
            )) as CurrencyQuotesWToken;
          quotes.coingeckoId = coingeckoId;
          return quotes;
        } catch (e) {
          logger.error("Failed to fetch quotes for token " + coingeckoId);
          logger.error(e);
        }
      }),
    ]);
    const result: Record<string, CurrencyQuotes> = {};
    quotesList.forEach((q) => {
      result[coingeckoIdMappings[q.coingeckoId]] = q;
    });
    return result;
  }

  private gatherTokenIds(taxableEvents: PortfolioMovement[]): string[] {
    const ids = new Set<string>();
    taxableEvents.forEach((e) => {
      e.transfers.forEach((t) => ids.add(t.asset_unique_id));
    });
    return [...ids].filter((id) => !!id);
  }

  private createCoingeckoTokenIdMapping(
    chain: string,
    tokenIds: string[],
  ): Record<string, string> {
    const result = {};
    if (fs.existsSync("./res/gen/" + chain + "-coingecko-mappings.json")) {
      const mappings = JSON.parse(
        fs.readFileSync(
          "./res/gen/" + chain + "-coingecko-mappings.json",
          "utf-8",
        ),
      ).mappings;
      tokenIds.forEach((id) => {
        const match = mappings.find((m) => m.uniqueId === id);
        if (match && match.coingeckoId) {
          result[match.coingeckoId] = id;
        }
      });
    }
    return result;
  }

  async addFiatValues(
    context: {
      address: string;
      chain: string;
      currency: string;
    },
    taxableEvents: PortfolioMovement[],
  ): Promise<void> {
    const coingeckoId = findCoingeckoIdForNativeToken(context.chain);
    const nativeTokenSymbol = subscanChains.chains.find(
      (c) => c.domain === context.chain,
    )?.token;

    const tokenIds = this.gatherTokenIds(taxableEvents);
    const coingeckoIdMappings = this.createCoingeckoTokenIdMapping(
      context.chain,
      tokenIds,
    );
    if (coingeckoId) {
      coingeckoIdMappings[coingeckoId] = nativeTokenSymbol;
    }

    const [quotes, fiatExchangeRates] = await Promise.all([
      this.fetchQuotes(coingeckoIdMappings, context.currency),
      this.fiatExchangeRateService.fetchExchangeRates(),
    ]);

    // convert fiat values which are given in USD by subscan
    if (context.currency.toUpperCase() !== "USD") {
      convertFiatValues(
        context.currency.toUpperCase(),
        taxableEvents,
        fiatExchangeRates,
      );
    }

    this.addFiatValuesForTxFees(taxableEvents, quotes);
    this.addFiatValuesToTaxableEvents(taxableEvents, quotes);
  }
}
