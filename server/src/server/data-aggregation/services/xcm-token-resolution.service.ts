import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { Asset } from "../../blockchain/substrate/model/asset";
import { ForeignAsset } from "../../blockchain/substrate/model/foreign-asset";
import {
  EventDetails,
  SubscanEvent,
} from "../../blockchain/substrate/model/subscan-event";
import { EventEnrichedXcmTransfer } from "../model/EventEnrichedXcmTransfer";
import * as subscanChains from "../../../../res/gen/subscan-chains.json";
import isEqual from "lodash.isequal";
import { XcmTransfer } from "../../blockchain/substrate/model/xcm-transfer";
import BigNumber from "bignumber.js";

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

  private async fetchAssets(chain: string): Promise<Asset[]> {
    const chainInfo = subscanChains.chains.find((c) => c.domain === chain);
    const results = (
      await Promise.all([
        this.subscanService.scanTokens(chain),
        chainInfo?.assetPallet
          ? this.subscanService.scanAssets(chain)
          : Promise.resolve(undefined),
        chainInfo?.foreignAssetsPallet
          ? this.subscanService.fetchForeignAssets(chain)
          : Promise.resolve(undefined),
      ])
    ).filter((v) => !!v);
    return results.flat();
  }

  async resolveTokens(
    chain: { domain: string; token: string },
    messages: XcmTransfer[],
    events: SubscanEvent[],
  ): Promise<EventEnrichedXcmTransfer[]> {
    const assets = await this.fetchAssets(chain.domain);
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
      };
    });
    const nativeToken = await this.subscanService.fetchNativeToken(
      chain.domain,
    );
    messages.forEach((xcm) => {
      xcm.transfers
        .filter((t) => t.destChain === chain.domain)
        .forEach((transfer) => {
          // Match by asset id of another chain
          const byAssetId = assets.find(
            (t) => t.unique_id === transfer.asset_unique_id,
          );
          if (byAssetId) {
            transfer.symbol = byAssetId.symbol;
            transfer.asset_unique_id = byAssetId.unique_id;
            return;
          }

          const symbol = transfer.symbol?.replace(/^xc/, "");

          // Find exactly one matching deposit with same symbol
          const matchingDeposits = deposits
            .filter((d) => d.timestamp)
            .filter((d) => d.symbol === symbol || d.symbol === "xc" + symbol);
          if (
            matchingDeposits.length === 1 ||
            new Set(matchingDeposits.map((d) => d.asset_unique_id)).entries
              .length === 1
          ) {
            transfer.symbol = matchingDeposits[0].symbol;
            transfer.asset_unique_id = matchingDeposits[0].asset_unique_id;
            transfer.amount = matchingDeposits[0].amount;
            return;
          }

          // Find exactly one deposit with same timestamp
          const anyDeposit = deposits.filter((d) => d.timestamp);
          if (
            anyDeposit.length === 1 ||
            new Set(matchingDeposits.map((d) => d.asset_unique_id)).entries
              .length === 1
          ) {
            transfer.symbol = anyDeposit[0].symbol;
            transfer.asset_unique_id = anyDeposit[0].asset_unique_id;
            transfer.amount = anyDeposit[0].amount;
            return;
          }

          // find one a single matching token for symbol in assets list
          if (symbol) {
            const bySymbol = assets.filter(
              (t) => t.symbol === symbol || t.symbol === "xc" + symbol,
            );
            if (bySymbol.length === 1) {
              transfer.symbol = bySymbol[0].symbol;
              transfer.asset_unique_id = bySymbol[0].asset_id;
              transfer.amount = new BigNumber(transfer.rawAmount)
                .multipliedBy(
                  new BigNumber(Math.pow(10, -bySymbol[0].decimals)),
                )
                .toNumber();
              return;
            }
          }

          // there's a balances deposit and the symbol matches the chain native symbol
          if (
            balancesdepositEvents.filter((d) => d.timestamp).length > 0 &&
            chain.token === symbol
          ) {
            transfer.symbol = symbol;
            transfer.asset_unique_id = symbol;
            transfer.amount = new BigNumber(transfer.rawAmount)
              .multipliedBy(
                new BigNumber(Math.pow(10, -nativeToken.token_decimals)),
              )
              .toNumber();
            return;
          }

          // anything else
          transfer.asset_unique_id = undefined;
          transfer.symbol = symbol;
        });
    });
    return messages as EventEnrichedXcmTransfer[];
  }
}
