import { logger } from "../logger/logger";
import { DataPlatformApi } from "./data-platform.api";
import { SubscanService } from "../blockchain/substrate/api/subscan.service";
import { CurrencyType } from "./model/currency-type";
import isEqual from "lodash.isequal";
import { Asset } from "../blockchain/substrate/model/asset";
import { Transfer } from "../blockchain/substrate/model/raw-transfer";
import { formatDate } from "../../common/util/date-utils";
import { toSubscanExtrinsixIndex } from "./helper/to-subscan-extrinsic-id";
import { parseCETDate } from "./helper/parse-cet-date";

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
  ): Promise<Transfer[]> {
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
  ): Promise<Transfer[]> {
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
    const transfers = eventsForChain.map((e, idx) => {
      const vToken = this.determineVToken(
        e.currencyType,
        e.currencyValue,
        tokens,
      );
      if (!vToken) {
        throw new Error(
          `vToken for event vtokenmintingMinted ${e.eventId}, ${e.timestamp} could not be determined.`,
        );
      }
      return {
        ...this.constructGenericTransferInfo(e, vToken),
        from: "",
        to: address,
        label: "Liquid staking token minted" as const,
      };
    });
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
  ): Promise<Transfer[]> {
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
    const transfers = eventsForChain.map((e, idx) => {
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
      return {
        ...this.constructGenericTransferInfo(e, vToken),
        from: address,
        to: "",
        label: "Liquid staking token redeemed" as const,
      };
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
  ): Promise<Transfer[]> {
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
        from: "",
        to: address,
        label: "Liquid staking token minted" as const,
      };
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
    function parseKind(jsonString) {
      if (typeof jsonString === "string") {
        const match = jsonString.match(/"__kind"\s*:\s*"([^"]+)"/);
        if (match) {
          return match[1]; // The captured value (e.g. "BNC")
        }
      }
      return jsonString; // No match → return original string
    }
    const combinedTokenId = { [currencyType]: parseKind(currencyValue) };
    if (isEqual(combinedTokenId, { Native: "BNC" })) {
      token = tokens.find((t) => isEqual(t.token_id, { VToken: "BNC" }));
    } else {
      const vTokenId = {};
      Object.keys(combinedTokenId).forEach((property) => {
        vTokenId["V" + property] = Number(combinedTokenId[property]);
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
  ) {
    const amount =
      Number(e.vestedAmount ?? e.vestedCurrencyAmount) *
      Math.pow(10, -vToken.decimals);
    return {
      symbol: vToken.symbol,
      asset_unique_id: vToken.unique_id,
      amount,
      block: Number(e.eventId.split("-")[0]),
      timestamp: parseCETDate(e.timestamp),
      extrinsic_index: toSubscanExtrinsixIndex(e.extrinsicId),
      label: "Liquid staking token minted" as const,
    };
  }
}
