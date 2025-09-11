import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { Asset } from "../../blockchain/substrate/model/asset";
import { ForeignAsset } from "../../blockchain/substrate/model/foreign-asset";
import {
  EventDetails,
  SubscanEvent,
} from "../../blockchain/substrate/model/subscan-event";
import { EventEnrichedXcmTransfer } from "../model/event-enriched-xcm-transfer";
import * as subscanChains from "../../../../res/gen/subscan-chains.json";
import isEqual from "lodash.isequal";
import { XcmTransfer } from "../../blockchain/substrate/model/xcm-transfer";
import stringSimilarity from "string-similarity";

const extractAsset = (
  property: string | string[],
  event: EventDetails,
  tokens: (Asset | ForeignAsset)[],
) => {
  const value = getPropertyValue(property, event);
  return tokens.find((t) => value == t.asset_id || isEqual(value, t.asset_id));
};

const getPropertyValue = (property: string | string[], event: EventDetails) => {
  if (!Array.isArray(property)) {
    property = [property];
  }
  return event.params.find((p) => property.includes(p.name))?.value;
};

export class XcmTokenResolutionService {
  constructor(private subscanService: SubscanService) {}

  private async fetchAssets(chain: {
    domain: string;
    token: string;
  }): Promise<Asset[]> {
    const chainInfo = subscanChains.chains.find(
      (c) => c.domain === chain.domain,
    );
    const results = (
      await Promise.all([
        this.subscanService.scanTokens(chain.domain),
        chainInfo?.assetPallet
          ? this.subscanService.scanAssets(chain.domain)
          : Promise.resolve(undefined),
        chainInfo?.foreignAssetsPallet
          ? this.subscanService.fetchForeignAssets(chain.domain)
          : Promise.resolve(undefined),
      ])
    ).filter((v) => !!v);
    const tokens: Asset[] = results.flat();
    const hasNative = tokens.find(
      (t) => t.unique_id === chain.token || t.native,
    );
    if (!hasNative) {
      tokens.push({
        id: chain.token,
        symbol: chain.token,
        unique_id: chain.token,
        decimals: (await this.subscanService.fetchNativeToken(chain.domain))
          .token_decimals,
        asset_id: chain.token,
      });
    }
    return tokens;
  }

  async resolveTokens(
    chain: { domain: string; token: string },
    messages: XcmTransfer[],
    events: SubscanEvent[],
  ): Promise<EventEnrichedXcmTransfer[]> {
    const assets = await this.fetchAssets(chain);
    const tokenDepositEvents = events.filter(
      (e) => e.event_id === "Deposited" && e.module_id !== "balances",
    );
    const balancesdepositEvents = events.filter(
      (e) => e.event_id === "Deposited" && e.module_id === "balances",
    );
    const eventsOfInterest: SubscanEvent[] = [];
    messages.forEach((xcm) =>
      xcm.transfers
        .filter((t) => t.destChain === chain.domain)
        .forEach((xcm: any) => {
          xcm.events = tokenDepositEvents
            .filter((e) => e.timestamp === xcm.timestamp)
            .map((e) => {
              eventsOfInterest.push(e);
              return {
                moduleId: e.module_id,
                eventId: e.event_id,
                eventIndex: e.event_index,
              };
            });
        }),
    );
    const eventDetails = await this.subscanService.fetchEventDetails(
      chain.domain,
      eventsOfInterest,
    );
    const deposits = eventDetails.map((e) => {
      const asset = extractAsset("currency_id", e, assets);
      const amount =
        Number(getPropertyValue("amount", e)) / Math.pow(10, asset?.decimals);
      return {
        timestamp: e.timestamp,
        module_id: e.module_id,
        original_event_id: e.original_event_index,
        amount,
        symbol: asset?.symbol,
        asset_unique_id: asset?.unique_id,
        extrinsic_index: e.extrinsic_index,
      };
    });
    messages.forEach((xcm) => {
      xcm.transfers
        .filter((t) => t.destChain === chain.domain)
        .filter((t) => !t.asset_unique_id)
        .forEach((transfer) => {
          const symbol = transfer.symbol;
          const depositsMatchingTimestamp = deposits.filter(
            (d) => d.timestamp,
          );

          // there's a balances deposit and the symbol matches the chain native symbol
          if (depositsMatchingTimestamp.length > 0 && chain.token === symbol) {
            transfer.asset_unique_id = symbol;
            xcm.extrinsic_index =
              xcm.extrinsic_index ??
              depositsMatchingTimestamp[0].extrinsic_index;
            return;
          }

          // Match by asset unique id of another chain
          const byAssetId = assets.find(
            (t) => t.unique_id === transfer.asset_unique_id_as_given,
          );
          if (byAssetId) {
            transfer.symbol = byAssetId.symbol;
            transfer.asset_unique_id = byAssetId.unique_id;
            return;
          }

          // find one a single matching token for symbol in assets list
          if (symbol) {
            const bySymbol = assets.filter(
              (t) => t.symbol === symbol || t.symbol === "xc" + symbol,
            );
            if (bySymbol.length === 1) {
              transfer.symbol = bySymbol[0].symbol;
              transfer.asset_unique_id = bySymbol[0].unique_id;
              return;
            }
          }

          // Find exactly one matching deposit with same symbol
          const matchingDeposits = deposits
            .filter((d) => d.timestamp)
            .filter((d) => d.symbol === symbol || d.symbol === "xc" + symbol);
          if (matchingDeposits.length === 1) {
            transfer.symbol = matchingDeposits[0].symbol;
            transfer.asset_unique_id = matchingDeposits[0].asset_unique_id;
            xcm.extrinsic_index =
              xcm.extrinsic_index ?? matchingDeposits[0].extrinsic_index;
            return;
          }

          // we pick the first asset id - even if this turns out to be wrong. it will be resolved during data-correction
          let bestAsset = assets.find(
            (a) => a.symbol.toUpperCase() === transfer.symbol.toUpperCase(),
          );
          if (!bestAsset) {
            const { bestMatch } = stringSimilarity.findBestMatch(
              transfer.symbol,
              assets.map((a) => a.symbol),
            );
            bestAsset = assets.find((a) => a.symbol === bestMatch.target);
          }
          transfer.asset_unique_id = bestAsset?.unique_id;
          transfer.symbol = bestAsset?.symbol ?? symbol;
        });
    });
    return messages as EventEnrichedXcmTransfer[];
  }
}
