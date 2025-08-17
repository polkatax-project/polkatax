import { SubscanService } from "../../../blockchain/substrate/api/subscan.service";
import { SubscanEvent } from "../../../blockchain/substrate/model/subscan-event";
import { logger } from "../../../logger/logger";
import { XcmTransfer } from "../../../blockchain/substrate/model/xcm-transfer";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";
import { fetchTokens } from "./fetch-tokens";
import { eventConfigs } from "./event-configs";
import { toTransfer } from "./to-transfer";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { TokenFromMultiLocationService } from "./token-from-multi-location.service";
import { isMultiLocation } from "../../../blockchain/substrate/util/identify-token-from-multi-location";

export class SpecialEventsToTransfersService {
  constructor(
    private subscanService: SubscanService,
    private tokenFromMultiLocationService: TokenFromMultiLocationService,
  ) {}

  private findMatchingConfig(
    chain: string,
    ev: { module_id: string; event_id: string },
  ) {
    return eventConfigs.find(
      (h) =>
        (h.chains.includes("*") || h.chains.includes(chain)) &&
        ev.module_id + ev.event_id === h.event,
    );
  }

  async convertToTransfer(
    chainInfo: { token: string; domain: string },
    assetMovments: EventDerivedAssetMovement | EventDerivedAssetMovement[],
  ) {
    if (!Array.isArray(assetMovments)) {
      assetMovments = [assetMovments];
    }
    await Promise.all(
      assetMovments.map(async (a) => {
        if (
          !a.token?.symbol &&
          a.tokenMultiLocation &&
          isMultiLocation(a.tokenMultiLocation)
        ) {
          const unique_id = a?.token?.unique_id;
          a.token =
            await this.tokenFromMultiLocationService.extractTokenInfoFromMultiLocation(
              chainInfo,
              a.tokenMultiLocation,
            );
          a.token.unique_id = a.token.unique_id ?? unique_id;
        }
      }),
    );
    return assetMovments.map((a) =>
      toTransfer(
        a.event,
        a.from,
        a.to,
        Number(a.rawAmount) / Math.pow(10, a?.token?.decimals),
        a?.token,
        a.xcm,
        a.label,
      ),
    );
  }

  async handleEvents(
    chainInfo: { token: string; domain: string },
    events: SubscanEvent[],
    xcmList: XcmTransfer[],
    throwOnError = false,
  ): Promise<EventDerivedTransfer[]> {
    const groupedEvents: Record<string, SubscanEvent[]> = {};
    events.forEach((e) => {
      if (!groupedEvents[e.extrinsic_index ?? e.timestamp]) {
        groupedEvents[e.extrinsic_index ?? e.timestamp] = [];
      }
      groupedEvents[e.extrinsic_index ?? e.timestamp].push(e);
    });

    const eventsOfInterest = events.filter((e) => {
      const config = this.findMatchingConfig(chainInfo.domain, e);
      if (!config) {
        return false;
      }
      if (!config.condition) {
        return true;
      }
      return config.condition(
        e,
        groupedEvents[e.extrinsic_index ?? e.timestamp],
        xcmList,
      );
    });

    const eventDetails = await this.subscanService.fetchEventDetails(
      chainInfo.domain,
      eventsOfInterest,
    );
    const extras = await fetchTokens(chainInfo, this.subscanService);

    const transfersFromEvents = (
      await Promise.all(
        eventDetails.map(async (details) => {
          try {
            const originalEvent = events.find(
              (e) => e.event_index === details.original_event_index,
            );
            const eventsInTx =
              groupedEvents[
                originalEvent.extrinsic_index ?? originalEvent.timestamp
              ];
            const eventDerivedAssetMovements = await this.findMatchingConfig(
              chainInfo.domain,
              details,
            ).handler(details, {
              ...extras,
              chainInfo,
              events: eventsInTx,
              xcmList,
            });
            return this.convertToTransfer(
              chainInfo,
              eventDerivedAssetMovements,
            );
          } catch (error) {
            logger.error(
              `Error mapping event to transfer: ${details.extrinsic_index}, ${details.original_event_index}, ${details.module_id} ${details.event_id}`,
            );
            logger.error(error);
            if (throwOnError) {
              throw error;
            }
            return undefined;
          }
        }),
      )
    )
      .flat()
      .filter((t) => !!t);

    const groupedTransfers: Record<string, [EventDerivedTransfer]> = {};
    transfersFromEvents.forEach((t) => {
      if (!groupedTransfers[t.extrinsic_index]) {
        groupedTransfers[t.extrinsic_index] = [t];
      } else {
        groupedTransfers[t.extrinsic_index].push(t);
      }
    });
    const gatheredTransfers = Object.values(groupedTransfers).flat();
    return gatheredTransfers;
  }
}
