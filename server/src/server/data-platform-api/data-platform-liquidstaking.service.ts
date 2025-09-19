import { logger } from "../logger/logger";
import { DataPlatformApi } from "./data-platform.api";
import { SubscanService } from "../blockchain/substrate/api/subscan.service";
import { CurrencyType } from "./model/currency-type";
import isEqual from "lodash.isequal";
import { Asset } from "../blockchain/substrate/model/asset";
import { formatDate } from "../../common/util/date-utils";
import { toSubscanExtrinsixIndex } from "./helper/to-subscan-extrinsic-id";
import { parseCETDate } from "./helper/parse-cet-date";
import { EventDerivedTransfer } from "../data-aggregation/model/event-derived-transfer";
import {
  bifrostParseKind,
  parseBifrostToken,
} from "../../common/util/parse-bifrost-token";

export class DataPlatformLiquidStakingService {
  constructor(
    private dataPlatformApi: DataPlatformApi,
    private subscanService: SubscanService,
  ) {}

  private get defaultMaxDate() {
    const currentYear = new Date().getFullYear();
    return new Date(`${currentYear + 1}-01-01T01:00:00Z`).getTime();
  }

  async fetchallVtokenEvents(
    address: string,
    chain: string,
    minDate?: number,
    maxDate: number = this.defaultMaxDate,
  ): Promise<EventDerivedTransfer[]> {
    if (chain !== "bifrost" && chain !== "bifrost-kusama") {
      return [];
    }

    const oneDay = 24 * 3600 * 60 * 1000;
    const minDateFormatted = formatDate(new Date(minDate - oneDay));
    const maxDateFormatted = formatDate(new Date(maxDate + oneDay));

    const events = (
      await Promise.all([
        this.fetchVtokenMintedEvents(
          address,
          chain,
          minDateFormatted,
          maxDateFormatted,
        ),
        this.fetchVtokenRebondedEvents(
          address,
          chain,
          minDateFormatted,
          maxDateFormatted,
        ),
        this.fetchVtokenRedeemedEvents(
          address,
          chain,
          minDateFormatted,
          maxDateFormatted,
        ),
      ])
    )
      .flat()
      .filter((e) => e.timestamp >= minDate && e.timestamp <= maxDate);
    return events;
  }

  async fetchVtokenMintedEvents(
    address: string,
    chain: string,
    minDate: string,
    maxDate: string,
  ): Promise<EventDerivedTransfer[]> {
    logger.info(
      `Entry fetchVtokenMintedEvents for ${address} and chain ${chain}`,
    );
    const chainType = chain === "bifrost" ? "POLKADOT" : "KUSAMA";
    const mintingEvents =
      await this.dataPlatformApi.fetchLiquidStakingMintedEvents(
        address,
        minDate,
        maxDate,
      );
    const eventsForChain =
      (mintingEvents?.items ?? []).find((m) => m.chainType === chainType)
        ?.liquidStakingResults ?? [];

    const tokens = await this.subscanService.scanTokens(chain);
    tokens.push({
      id: "BNC",
      asset_id: "BNC",
      symbol: "BNC",
      unique_id: "BNC",
      decimals: (await this.subscanService.fetchNativeToken(chain))
        .token_decimals,
    });
    const transfers: EventDerivedTransfer[] = eventsForChain.flatMap(
      (e, idx) => {
        const fromToken = parseBifrostToken(
          e.currencyType,
          e.currencyValue,
          tokens,
        );
        const vToken = this.determineVToken(
          e.currencyType,
          e.currencyValue,
          tokens,
        );
        if (!vToken || !fromToken) {
          throw new Error(
            `vToken for event vtokenmintingMinted ${e.eventId}, ${e.timestamp} could not be determined.`,
          );
        }
        return [
          {
            ...this.constructGenericTransferInfo(e, vToken),
            from: undefined,
            to: address,
            label: "Liquid staking token minted" as const,
            event_id: "Minted",
            module_id: "vtokenminting",
          },
          {
            event_id: "Minted",
            module_id: "vtokenminting",
            symbol: fromToken.symbol,
            asset_unique_id: fromToken.unique_id,
            original_event_index: e.eventId,
            semanticGroupId: e.eventId,
            amount: e.amount * 10 ** -vToken.decimals,
            block: Number(e.eventId.split("-")[0]),
            timestamp: parseCETDate(e.timestamp),
            extrinsic_index: toSubscanExtrinsixIndex(e.extrinsicId),
            label: "Liquid staking token minted" as const,
          },
        ] as EventDerivedTransfer[];
      },
    );
    logger.info(
      `Exit fetchVtokenMintedEvents with ${transfers.length} entries`,
    );
    return transfers;
  }

  async fetchVtokenRedeemedEvents(
    address: string,
    chain: string,
    minDate: string,
    maxDate: string,
  ): Promise<EventDerivedTransfer[]> {
    logger.info(
      `Entry fetchVtokenRedeemedEvents for ${address} and chain ${chain}`,
    );
    const chainType = chain === "bifrost" ? "POLKADOT" : "KUSAMA";
    const mintingEvents =
      await this.dataPlatformApi.fetchLiquidStakingRedeemedEvents(
        address,
        minDate,
        maxDate,
      );
    const eventsForChain =
      (mintingEvents?.items ?? []).find((m) => m.chainType === chainType)
        ?.liquidStakingResults ?? [];

    const tokens = await this.subscanService.scanTokens(chain);
    const transfers = eventsForChain.flatMap((e, idx) => {
      const vToken = this.determineVToken(
        e.currencyType,
        e.currencyValue,
        tokens,
      );
      if (!vToken) {
        throw new Error(
          `vToken for event vtokenmintingRedeemed ${e.eventId}, ${e.timestamp} could not be determined.`,
        );
      }
      return [
        {
          ...this.constructGenericTransferInfo(e, vToken),
          from: address,
          to: undefined,
          label: "Liquid staking token redeemed" as const,
          event_id: "Redeemed",
          module: "vtokenminting",
        },
        {
          vent_id: "Redeemed",
          module: "vtokenminting",
          symbol: vToken.symbol,
          asset_unique_id: vToken.unique_id,
          original_event_index: e.eventId,
          semanticGroupId: "Fee for " + e.eventId,
          amount: e.redeemFee * 10 ** -vToken.decimals,
          block: Number(e.eventId.split("-")[0]),
          timestamp: parseCETDate(e.timestamp),
          extrinsic_index: toSubscanExtrinsixIndex(e.extrinsicId),
          label: "Fee" as const,
        },
      ] as EventDerivedTransfer[];
    });

    logger.info(
      `Exit fetchVtokenRedeemedEvents with ${transfers.length} entries`,
    );
    return transfers;
  }

  async fetchVtokenRebondedEvents(
    address: string,
    chain: string,
    minDate: string,
    maxDate: string,
  ): Promise<EventDerivedTransfer[]> {
    logger.info(
      `Entry fetchLiquidStakingRebondedEvents for ${address} and chain ${chain}`,
    );
    const chainType = chain === "bifrost" ? "POLKADOT" : "KUSAMA";
    const mintingEvents =
      await this.dataPlatformApi.fetchLiquidStakingRebondedEvents(
        address,
        minDate,
        maxDate,
      );
    const eventsForChain =
      (mintingEvents?.items ?? []).find((m) => m.chainType === chainType)
        ?.liquidStakingResults ?? [];

    const tokens = await this.subscanService.scanTokens(chain);
    const transfers = eventsForChain.map((e, idx) => {
      const vToken = this.determineVToken(
        e.currencyType,
        e.currencyValue,
        tokens,
      );
      if (!vToken) {
        throw new Error(
          `vToken for event vtokenmintingRebonded ${e.eventId}, ${e.timestamp} could not be determined.`,
        );
      }
      return {
        ...this.constructGenericTransferInfo(e, vToken),
        from: undefined,
        to: address,
        label: "Liquid staking token rebonded" as const,
        event_id: "Rebonded",
        module: "vtokenminting",
      } as EventDerivedTransfer;
    });
    logger.info(
      `Exit fetchLiquidStakingRebondedEvents with ${transfers.length} entries`,
    );
    return transfers;
  }

  private determineVToken(
    currencyType: CurrencyType,
    currencyValue: string,
    tokens: Asset[],
  ): Asset {
    let token: Asset;
    const parsedCurrencyValue = bifrostParseKind(currencyValue);
    const combinedTokenId = { [currencyType]: parsedCurrencyValue };
    if (isEqual(combinedTokenId, { Native: "BNC" })) {
      token = tokens.find((t) => isEqual(t.token_id, { VToken: "BNC" }));
    } else {
      const vTokenId = {};
      Object.keys(combinedTokenId).forEach((property) => {
        vTokenId["V" + property] = combinedTokenId[property];
      });
      token = tokens.find((t) => isEqual(t.token_id, vTokenId));
    }
    return token;
  }

  private constructGenericTransferInfo(
    e: {
      eventId: string;
      timestamp: string;
      vestedAmount?: number;
      vestedCurrencyAmount?: number;
      extrinsicId: string;
    },
    vToken: Asset,
  ): Partial<EventDerivedTransfer> {
    const amount =
      Number(e.vestedAmount ?? e.vestedCurrencyAmount) * 10 ** -vToken.decimals;
    return {
      symbol: vToken.symbol,
      asset_unique_id: vToken.unique_id,
      original_event_index: e.eventId,
      semanticGroupId: e.eventId,
      amount,
      block: Number(e.eventId.split("-")[0]),
      timestamp: parseCETDate(e.timestamp),
      extrinsic_index: toSubscanExtrinsixIndex(e.extrinsicId),
      label: "Liquid staking token minted" as const,
    };
  }
}
