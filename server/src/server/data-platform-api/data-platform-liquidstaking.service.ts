import { convertToGenericAddress } from "../../common/util/convert-to-generic-address";
import { logger } from "../logger/logger";
import { DataPlatformApi } from "./data-platform.api";
import { isValidEvmAddress } from "../../common/util/is-valid-address";
import { SubscanService } from "../blockchain/substrate/api/subscan.service";
import { CurrencyType } from "./model/currency-type";
import isEqual from "lodash.isequal";
import { Asset } from "../blockchain/substrate/model/asset";
import { Transfer } from "../blockchain/substrate/model/raw-transfer";
import { formatDate } from "../../common/util/date-utils";

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
    const genericAddress = isValidEvmAddress(address)
      ? address
      : convertToGenericAddress(address);
    const mintingEvents =
      await this.dataPlatformApi.fetchLiquidStakingMintedEvents(
        genericAddress,
        minDate,
        maxDate,
      );
    const eventsForChain = mintingEvents.items.find(
      (m) => m.chainType === chainType,
    ).liquidStakingResults;

    const tokens = await this.subscanService.scanTokens(chain);
    const forEnrichment = await this.fetchDataToEnrich(
      chain,
      eventsForChain.map((e) => e.eventId),
    );
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
        ...this.constructGenericTransferInfo(e, vToken, forEnrichment[idx]),
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
    const genericAddress = isValidEvmAddress(address)
      ? address
      : convertToGenericAddress(address);
    const mintingEvents =
      await this.dataPlatformApi.fetchLiquidStakingRedeemedEvents(
        genericAddress,
        minDate,
        maxDate,
      );
    const eventsForChain = mintingEvents.items.find(
      (m) => m.chainType === chainType,
    ).liquidStakingResults;

    const tokens = await this.subscanService.scanTokens(chain);
    const forEnrichment = await this.fetchDataToEnrich(
      chain,
      eventsForChain.map((e) => e.eventId),
    );
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
        ...this.constructGenericTransferInfo(e, vToken, forEnrichment[idx]),
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
    const genericAddress = isValidEvmAddress(address)
      ? address
      : convertToGenericAddress(address);
    const mintingEvents =
      await this.dataPlatformApi.fetchLiquidStakingRebondedEvents(
        genericAddress,
        minDate,
        maxDate,
      );
    const eventsForChain = mintingEvents.items.find(
      (m) => m.chainType === chainType,
    ).liquidStakingResults;

    const tokens = await this.subscanService.scanTokens(chain);
    const forEnrichment = await this.fetchDataToEnrich(
      chain,
      eventsForChain.map((e) => e.eventId),
    );
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
        ...this.constructGenericTransferInfo(e, vToken, forEnrichment[idx]),
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
    const combinedTokenId = { [currencyType]: currencyValue };
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

  private toSubscanEventIndex(eventId: string) {
    const parts = eventId.split("-");
    return String(Number(parts[0])) + "-" + String(Number(parts[2]));
  }

  private async fetchDataToEnrich(
    chain: string,
    event_ids: string[],
  ): Promise<{ extrinsic_index: string; hash: string }[]> {
    const events = await this.subscanService.fetchEventDetails(
      chain,
      undefined,
      event_ids.map((id) => this.toSubscanEventIndex(id)),
    );
    return events.map((e) => ({
      extrinsic_index: e.extrinsic_index,
      hash: e.extrinsic_hash,
    }));
  }

  private constructGenericTransferInfo(
    e: {
      eventId: string;
      timestamp: string;
      vestedAmount?: number;
      vestedCurrencyAmount?: number;
    },
    vToken: Asset,
    enrichmentData: { extrinsic_index: string; hash: string },
  ) {
    const amount =
      Number(e.vestedAmount ?? e.vestedCurrencyAmount) *
      Math.pow(10, -vToken.decimals);
    return {
      symbol: vToken.symbol,
      asset_unique_id: vToken.unique_id,
      amount,
      block: Number(e.eventId.split("-")[0]),
      timestamp: new Date(e.timestamp).getTime(),
      extrinsic_index: enrichmentData.extrinsic_index,
      hash: enrichmentData.hash,
      label: "Liquid staking token minted" as const,
    };
  }
}
