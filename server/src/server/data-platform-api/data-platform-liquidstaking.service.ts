import { convertToGenericAddress } from "../../common/util/convert-to-generic-address";
import { logger } from "../logger/logger";
import { DataPlatformApi } from "./data-platform.api";
import { isValidEvmAddress } from "../../common/util/is-valid-address";
import { SubscanService } from "../blockchain/substrate/api/subscan.service";
import { CurrencyType } from "./model/currency-type";
import isEqual from "lodash.isequal";
import { Asset } from "../blockchain/substrate/model/asset";

function endOfDayUTC(dateStr: string): number {
  const dateTimeStr = `${dateStr}T23:59:59.999Z`;
  return new Date(dateTimeStr).getTime();
}

export class DataPlatformLiquidStakingService {
  constructor(
    private dataPlatformApi: DataPlatformApi,
    private subscanService: SubscanService,
  ) {}

  async fetchVtokenMintedEvents(
    address: string,
    chain: string,
    minDate: string = `${new Date().getUTCFullYear() - 1}-01-01`,
    maxDate: string = `${new Date().getUTCFullYear() - 1}-12-31`,
  ): Promise<any> {
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
    logger.info(
      `Exit fetchVtokenMintedEvents with ${mintingEvents.items.length} entries`,
    );
    return eventsForChain;
  }

  async fetchVtokenRedeemedEvents(
    address: string,
    chain: string,
    minDate: string = `${new Date().getUTCFullYear() - 1}-01-01`,
    maxDate: string = `${new Date().getUTCFullYear() - 1}-12-31`,
  ): Promise<any> {
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
    logger.info(
      `Exit fetchVtokenRedeemedEvents with ${eventsForChain.length} entries`,
    );
    return eventsForChain;
  }

  async fetchVtokenRebondedEvents(
    address: string,
    chain: string,
    minDate: string = `${new Date().getUTCFullYear() - 1}-01-01`,
    maxDate: string = `${new Date().getUTCFullYear() - 1}-12-31`,
  ): Promise<any> {
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
    logger.info(
      `Exit fetchLiquidStakingRebondedEvents with ${eventsForChain.length} entries`,
    );
    return eventsForChain;
  }

  private determineVToken(
    currencyType: CurrencyType,
    currencyValue: string,
    assets: Asset[],
  ): Asset {
    let token: Asset;
    const combinedTokenId = { [currencyType]: currencyValue };
    if (isEqual(combinedTokenId, { Native: "BNC" })) {
      token = assets.find((t) => isEqual(t.token_id, { VToken: "BNC" }));
    } else {
      const vTokenId = {};
      Object.keys(combinedTokenId).forEach((property) => {
        vTokenId["V" + property] = combinedTokenId[property];
      });
      token = assets.find((t) => isEqual(t.token_id, vTokenId));
    }
    return token;
  }
}
