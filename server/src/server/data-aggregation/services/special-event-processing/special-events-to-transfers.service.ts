import { SubscanService } from "../../../blockchain/substrate/api/subscan.service";
import { SubscanEvent } from "../../../blockchain/substrate/model/subscan-event";
import { logger } from "../../../logger/logger";
import { XcmTransfer } from "../../../blockchain/substrate/model/xcm-transfer";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";
import { fetchTokens } from "./fetch-tokens";
import { eventConfigs } from "./event-configs";

export class SpecialEventsToTransfersService {
  constructor(private subscanService: SubscanService) {}

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
            return await this.findMatchingConfig(
              chainInfo.domain,
              details,
            ).handler(chainInfo, details, {
              ...extras,
              events: eventsInTx,
              xcmList,
            });
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
