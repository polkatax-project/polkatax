import { logger } from "../../logger/logger";
import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { Payment } from "../model/payment";
import {
  EventDetails,
  SubscanEvent,
} from "../../blockchain/substrate/model/subscan-event";
import BigNumber from "bignumber.js";

export class HandleUnmatchedEventsService {
  constructor(private subscanService: SubscanService) {}

  private eventsOfInterest = [
    { module_id: "balances", event_id: "Burned" },
    { module_id: "balances", event_id: "Withdraw" },
    { module_id: "balances", event_id: "Slashed" },
    { module_id: "balances", event_id: "Deposit" },
    { module_id: "balances", event_id: "ReserveRepatriated" },
    { module_id: "balances", event_id: "Minted" },
  ];

  private matchesEventOfInterest(ev: SubscanEvent) {
    return this.eventsOfInterest.find(
      (i) => i.event_id === ev.event_id && ev.module_id == i.module_id,
    );
  }

  private async fetchEventDetailsOfRelevantEvents(
    chainName: string,
    payments: Payment[],
    events: SubscanEvent[],
  ): Promise<EventDetails[]> {
    let relevantUnaccountedEvents = events.filter((e) =>
      this.matchesEventOfInterest(e),
    );

    const eventDetails = await this.subscanService.fetchEventDetails(
      chainName,
      relevantUnaccountedEvents,
    );

    /**
     * We filter again by matching `extrinsic_index` because, in some cases, the `extrinsic_index` in the `subscanEvent` is undefined.
     * However, fetching full event details later reveals the correct `extrinsic_index`, allowing us to map previously unmatched events to payments.
     * Events which belong to payments that already have transfers are skipped.
     */
    return eventDetails.filter(
      (e) =>
        !payments.find(
          (p) =>
            (p.transfers.length > 0 &&
              (p.extrinsic_index === e.extrinsic_index ||
            p.transfers.some((t) => t.extrinsic_index === e.extrinsic_index))))
    );
  }

  private enrichExistingPayment(
    matchingTx: Payment,
    eventDetails: EventDetails[],
    tokenDecimals: number,
    symbol: string,
    address: string,
  ): void {
    const tempPayment = this.mapEventsToPayment(
      eventDetails,
      tokenDecimals,
      symbol,
      address,
      matchingTx,
    );
    if (tempPayment.transfers.length > 0) {
      matchingTx.events.push(...tempPayment.events);
      matchingTx.transfers = tempPayment.transfers;
    }
  }

  private mapEventsToPayment(
    eventDetails: EventDetails[],
    tokenDecimals: number,
    symbol: string,
    address: string,
    matchingTx?: Payment,
  ): Payment {
    const transfer = eventDetails.reduce(
      (current, ev) => {
        current.amount +=
          (ev.event_id === "Minted" || ev.event_id === "Deposit" ? 1 : -1) *
          new BigNumber(
            ev.params.find((param) => param.name === "amount")?.value,
          )
            .multipliedBy(Math.pow(10, -tokenDecimals))
            .toNumber();
        return current;
      },
      {
        amount: matchingTx
          ? (matchingTx.feeUsed ?? 0) + (matchingTx.tip ?? 0)
          : 0,
      },
    );
    return {
      hash: eventDetails[0].extrinsic_hash,
      block: eventDetails[0].block_num,
      timestamp: eventDetails[0].timestamp,
      extrinsic_index: eventDetails[0].extrinsic_index,
      events: eventDetails.map((e) => ({
        moduleId: e.module_id,
        eventId: e.event_id,
      })),
      provenance: "event",
      transfers:
        transfer.amount !== 0
          ? [
              {
                amount: transfer.amount,
                symbol: symbol,
                tokenId: symbol,
                from: transfer.amount < 0 ? address : undefined,
                to: transfer.amount > 0 ? address : undefined,
                extrinsic_index: eventDetails[0].event_index,
                module: eventDetails[0].module_id,
              },
            ]
          : [],
    };
  }

  async convertEvents(
    context: { address: string; chain: { domain: string; token: string } },
    unmatchedEvents: SubscanEvent[],
    payments: Payment[],
  ): Promise<{ eventPayments: Payment[], unusedEvents: SubscanEvent[] }> {
    logger.info("Enter createPaymentsFromEvents");
    const token = await this.subscanService.fetchNativeToken(
      context.chain.domain,
    );
    const eventDetails = await this.fetchEventDetailsOfRelevantEvents(
      context.chain.domain,
      payments,
      unmatchedEvents,
    );
    const unusedEvents = unmatchedEvents.filter(e => !eventDetails.find(d => d.original_event_index === e.event_index))
    const indexedEvents: Record<string, EventDetails[]> = eventDetails.reduce(
      (current, event) => {
        current[event.extrinsic_index] ??= [];
        current[event.extrinsic_index].push(event);
        return current;
      },
      {},
    );
    const indexedPayments: Record<string, Payment> = {};
    payments.forEach((p) => (indexedPayments[p.extrinsic_index] = p));

    Object.values(indexedEvents)
      .filter((ev) => indexedPayments[ev[0].extrinsic_index])
      .forEach((ev) =>
        this.enrichExistingPayment(
          indexedPayments[ev[0].extrinsic_index],
          ev,
          token.token_decimals,
          context.chain.token,
          context.address,
        ),
      );
    const eventPayments = Object.values(indexedEvents)
      .filter((ev) => !indexedPayments[ev[0].extrinsic_index])
      .map((ev) =>
        this.mapEventsToPayment(
          ev,
          token.token_decimals,
          context.chain.token,
          context.address,
        ),
      );

    logger.info("Exit createPaymentsFromEvents");
    return { eventPayments, unusedEvents};
  }
}
