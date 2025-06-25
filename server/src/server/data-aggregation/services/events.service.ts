import { SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { Payment } from "../model/payment";
import { HandleUnmatchedEventsService } from "./handle-unmatched-events.service";
import { SpecialEventsToTransfersService } from "./special-events-to-transfers.service";

export class EventsService {
    constructor(private specialEventsToTransfersService: SpecialEventsToTransfersService,
        private handleUnmatchedEventsService: HandleUnmatchedEventsService) {
    }

    async mapSpecialEventsToTransfers(chain: string, events: SubscanEvent[]) {
        return await this.specialEventsToTransfersService.handleEvents(chain, events)
    }

    async convertUnmatchedEvents(
        context: { address: string; chain: { domain: string; token: string } },
        unmatchedEvents: SubscanEvent[],
        payments: Payment[],
      ) {
        return this.handleUnmatchedEventsService.convertEvents(context, unmatchedEvents, payments)
      }

}