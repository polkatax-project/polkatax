import { logger } from "../logger/logger";
import { DataPlatformApi } from "./data-platform.api";
import { dataPlatformChains } from "./model/data-platform-chains";
import {
  toSubscanEventIndex,
  toSubscanExtrinsixIndex,
} from "./helper/to-subscan-extrinsic-id";
import { parseCETDate } from "./helper/parse-cet-date";
import { formatDate } from "../../common/util/date-utils";
import { BalanceEvent } from "./model/balance-event";
import { EventDetails } from "../blockchain/substrate/model/subscan-event";

export class DataPlatformBalanceEventsService {
  constructor(private dataPlatformApi: DataPlatformApi) {}

  async fetchBalanceEvents(
    address: string,
    chain: string,
    minDate: number,
    maxDate: number = Date.now(),
  ): Promise<Partial<EventDetails>[]> {
    logger.info(`Entry fetchBalanceEvents for ${address} and chain ${chain}`);
    const oneDay = 24 * 3600 * 60 * 1000;
    const minDateFormatted = formatDate(new Date(minDate - oneDay));
    const maxDateFormatted = formatDate(new Date(maxDate + oneDay));

    const dataPlatformChain = dataPlatformChains.find(
      (d) => d.domain === chain,
    )?.chainType;
    if (!dataPlatformChain) {
      throw new Error(
        "Data platform does not support balance events for chain " + chain,
      );
    }

    const balanceEvents: BalanceEvent[] =
      await this.dataPlatformApi.fetchBalanceEvents(
        dataPlatformChain,
        address,
        minDateFormatted,
        maxDateFormatted,
      );
    const mapBalanceType = (type: string) => {
      switch (type) {
        case "WITHDRAW":
          return "Withdraw";
        case "DEPOSIT":
          return "Deposit";
        default:
          return;
      }
    };

    const eventDetails = balanceEvents
      .filter((e) => !!e.eventId)
      .map((e) => {
        const eventIndex = toSubscanEventIndex(e.eventId);
        const balanceType = mapBalanceType(e.balanceMovementType);
        return {
          event_index: eventIndex,
          extrinsic_index: e.extrinsicId
            ? toSubscanExtrinsixIndex(e.extrinsicId)
            : e.blockNumber + "-",
          block_num: e.blockNumber,
          module_id: "balances",
          event_id: balanceType,
          original_event_index: eventIndex,
          timestamp: parseCETDate(e.blockTimestamp),
          params: [
            {
              name: "amount",
              value: e.amount,
            },
          ],
        };
      })
      .filter((e) => !!e.event_index);

    logger.info(`Exit fetchBalanceEvents with ${eventDetails.length} entries`);
    return eventDetails;
  }
}
