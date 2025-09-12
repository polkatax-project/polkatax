import { convertToCanonicalAddress } from "../../../common/util/convert-to-canonical-address";
import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { MultiLocation } from "../../blockchain/substrate/model/multi-location";
import { Transfer } from "../../blockchain/substrate/model/raw-transfer";
import {
  EventDetails,
  SubscanEvent,
} from "../../blockchain/substrate/model/subscan-event";
import { logger } from "../../logger/logger";
import { FetchPortfolioMovementsRequest } from "../model/fetch-portfolio-movements.request";
import { PortfolioMovement } from "../model/portfolio-movement";
import { getPropertyValue } from "./special-event-processing/helper";
import isEqual from "lodash.isequal";

export class BalanceChangesService {
  constructor(private subscanService: SubscanService) {}

  async fetchAllBalanceChanges(
    request: FetchPortfolioMovementsRequest,
    subscanEvents: SubscanEvent[],
    isMyAccount: (address: string) => boolean,
  ): Promise<PortfolioMovement[]> {
    logger.info(
      `Entry fetchAllBalanceChanges for ${request.chain.domain} and ${request.address}. SubscanEvents: ${subscanEvents.length}`,
    );
    let portfolioMovements: PortfolioMovement[] = [];
    await this.fetchBalanceMovements(
      request.chain,
      request.address,
      subscanEvents,
      portfolioMovements,
    );
    await this.fetchAssetMovements(
      request.chain,
      request.address,
      subscanEvents,
      portfolioMovements,
    );
    await this.fetchForeignAssetMovements(
      request.chain,
      request.address,
      subscanEvents,
      portfolioMovements,
    );
    await this.fetchTokenMovements(
      request.chain,
      request.address,
      subscanEvents,
      portfolioMovements,
    );

    let transfers = await this.subscanService.fetchAllTransfers({
      chainName: request.chain.domain,
      ...request,
    });
    transfers = transfers.filter(
      (t) => t.timestamp >= request.minDate && t.timestamp <= request.maxDate,
    );
    this.addToPortFolioMovements(portfolioMovements, transfers, isMyAccount);

    portfolioMovements = portfolioMovements.sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    logger.info(
      `Exit fetchAllBalanceChanges for ${request.chain.domain} and ${request.address} with ${portfolioMovements.length} entries`,
    );
    return portfolioMovements;
  }

  private addToPortFolioMovements(
    portfolioMovements: PortfolioMovement[],
    transfers: Transfer[],
    isMyAccount: (address: string) => boolean,
  ) {
    for (const transfer of transfers) {
      let movement = portfolioMovements.find(
        (p) => p.extrinsic_index === transfer.extrinsic_index,
      );
      if (!movement) {
        movement = {
          hash: transfer.hash,
          block: transfer.block,
          timestamp: transfer.timestamp,
          extrinsic_index: transfer.extrinsic_index,
          events: [],
          transfers: [],
        };
        portfolioMovements.push(movement);
      }
      movement.transfers.push({
        ...transfer,
        to: transfer.to ? convertToCanonicalAddress(transfer.to) : "",
        from: transfer.from ? convertToCanonicalAddress(transfer.from) : "",
        amount: isMyAccount(transfer.to)
          ? Math.abs(transfer.amount)
          : -Math.abs(transfer.amount),
      });
    }
  }

  private update(
    portfolioMovements: PortfolioMovement[],
    event: EventDetails,
    symbol: string,
    asset_unique_id: string,
    from: string,
    to: string,
    amount: number,
  ) {
    let movement = portfolioMovements.find(
      (p) => p.extrinsic_index === event.extrinsic_index,
    );
    if (!movement) {
      movement = {
        hash: event.extrinsic_hash,
        block: event.block_num,
        timestamp: event.timestamp,
        extrinsic_index: event.extrinsic_index,
        events: [],
        transfers: [],
      };
      portfolioMovements.push(movement);
    }
    movement.transfers.push({
      symbol,
      amount,
      from,
      to,
      extrinsic_index: event.extrinsic_index,
      asset_unique_id,
      event_index: event.original_event_index,
    });
  }

  async fetchBalanceMovements(
    chain: { domain: string; token: string },
    address: string,
    events: SubscanEvent[],
    portfolioMovements: PortfolioMovement[],
  ): Promise<void> {
    logger.info(
      `Entry BalancesChangesService.fetchBalanceMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`,
    );
    const eventIds = ["Withdraw", "Burned", "Deposit", "Minted"];
    const eventDetails: EventDetails[] =
      await this.subscanService.fetchEventDetails(
        chain.domain,
        events.filter(
          (e) => e.module_id === "balances" && eventIds.includes(e.event_id),
        ),
      );
    const nativeToken = await this.subscanService.fetchNativeToken(
      chain.domain,
    );
    const decimals = nativeToken.token_decimals;
    for (const event of eventDetails) {
      let amount = 0;
      let to = "";
      let from = "";
      switch (event.event_id) {
        case "Withdraw":
        case "Burned":
          amount -= getPropertyValue("amount", event) * 10 ** -decimals;
          from = address;
          break;
        case "Deposit":
        case "Minted":
          to = address;
          amount += getPropertyValue("amount", event) * 10 ** -decimals;
          break;
        default:
          continue;
      }
      this.update(
        portfolioMovements,
        event,
        chain.token,
        chain.token,
        to,
        from,
        amount,
      );
    }
    logger.info(
      `Exit BalancesChangesService.fetchBalanceMovements for ${chain.domain} and ${address}} with ${eventDetails.length} entries`,
    );
  }

  async fetchAssetMovements(
    chain: { domain: string; token: string },
    address: string,
    events: SubscanEvent[],
    portfolioMovements: PortfolioMovement[],
  ): Promise<void> {
    logger.info(
      `Entry BalancesChangesService.fetchAssetMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`,
    );
    const eventIds = ["Withdrawn", "Burned", "Deposited", "Issued"];
    const assetEventDetails: EventDetails[] =
      await this.subscanService.fetchEventDetails(
        chain.domain,
        events.filter(
          (e) => e.module_id === "assets" && eventIds.includes(e.event_id),
        ),
      );
    if (assetEventDetails.length === 0) {
      return;
    }
    const assets = await this.subscanService.scanAssets(chain.domain);
    if (!assets || assets.length === 0) {
      logger.warn(`fetchAssetMovements: No assets found for ${chain.domain}.`);
      return; // Moonbeam has assets events but no assets endpoint.
    }
    for (const event of assetEventDetails) {
      const assetId = getPropertyValue("asset_id", event);
      const asset = assets.find((a) => a.asset_id == assetId);
      let amount = 0;
      let to = "";
      let from = "";
      switch (event.event_id) {
        case "Withdrawn":
          amount -=
            getPropertyValue(["amount", "balance"], event) *
            10 ** -asset.decimals;
          from = address;
          break;
        case "Burned":
          amount -=
            getPropertyValue(["amount", "balance"], event) *
            10 ** -asset.decimals;
          from = address;
          break;
        case "Deposited":
          amount +=
            getPropertyValue(["amount", "balance"], event) *
            10 ** -asset.decimals;
          to = address;
          break;
        case "Issued":
          amount +=
            getPropertyValue(["amount", "balance"], event) *
            10 ** -asset.decimals;
          to = address;
          break;
        default:
          continue;
      }
      this.update(
        portfolioMovements,
        event,
        asset.symbol,
        asset.unique_id,
        to,
        from,
        amount,
      );
    }
    logger.info(
      `Exit BalancesChangesService.fetchAssetMovements for ${chain.domain} and ${address} with ${assetEventDetails.length} entries`,
    );
  }

  async fetchForeignAssetMovements(
    chain: { domain: string; token: string },
    address: string,
    events: SubscanEvent[],
    portfolioMovements: PortfolioMovement[],
  ): Promise<void> {
    logger.info(
      `Entry BalancesChangesService.fetchForeignAssetMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`,
    );
    const eventIds = ["Withdrawn", "Burned", "Deposited", "Issued"];
    const foreignAssetEventDetails: EventDetails[] =
      await this.subscanService.fetchEventDetails(
        chain.domain,
        events.filter(
          (e) =>
            e.module_id === "foreignassets" && eventIds.includes(e.event_id),
        ),
      );
    if (foreignAssetEventDetails.length === 0) {
      return;
    }
    const foreignAssets = await this.subscanService.fetchForeignAssets(
      chain.domain,
    );

    for (const event of foreignAssetEventDetails) {
      const assetId: MultiLocation = getPropertyValue("asset_id", event);
      let foreignAsset = foreignAssets.find((a) =>
        isEqual(a.multi_location, assetId),
      );
      if (!foreignAsset && typeof assetId?.interior?.X1 === "object") {
        const assetIdAlt = {
          parents: assetId.parents,
          interior: { X1: [assetId?.interior?.X1] },
        };
        foreignAsset = foreignAssets.find((a) =>
          isEqual(a.multi_location, assetIdAlt),
        );
      }
      let amount = 0;
      let to = "";
      let from = "";
      switch (event.event_id) {
        case "Withdrawn":
          amount -=
            getPropertyValue(["amount", "balance"], event) *
            10 ** -foreignAsset.decimals;
          from = address;
          break;
        case "Burned":
          amount -=
            getPropertyValue(["amount", "balance"], event) *
            10 ** -foreignAsset.decimals;
          from = address;
          break;
        case "Deposited":
          to = address;
          amount +=
            getPropertyValue(["amount", "balance"], event) *
            (10 * -foreignAsset.decimals);
          break;
        case "Issued":
          to = address;
          amount +=
            getPropertyValue(["amount", "balance"], event) *
            10 ** -foreignAsset.decimals;
          break;
        default:
          continue;
      }
      this.update(
        portfolioMovements,
        event,
        foreignAsset.symbol,
        foreignAsset.unique_id,
        to,
        from,
        amount,
      );
    }
    logger.info(
      `Exit BalancesChangesService.fetchForeignAssetMovements for ${chain.domain} and ${address} with ${foreignAssetEventDetails.length} entries`,
    );
  }

  async fetchTokenMovements(
    chain: { domain: string; token: string },
    address: string,
    events: SubscanEvent[],
    portfolioMovements: PortfolioMovement[],
  ): Promise<void> {
    logger.info(
      `Entry BalancesChangesService.fetchTokenMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`,
    );
    const eventIds = ["Withdrawn", "Deposited"];
    const tokenEventDetails: EventDetails[] =
      await this.subscanService.fetchEventDetails(
        chain.domain,
        events.filter(
          (e) => e.module_id === "tokens" && eventIds.includes(e.event_id),
        ),
      );
    if (tokenEventDetails.length === 0) {
      return;
    }
    const tokens = await this.subscanService.scanTokens(chain.domain);
    for (const event of tokenEventDetails) {
      const token_id = getPropertyValue("currency_id", event);
      let token = tokens.find(
        (t) => t.token_id === token_id || isEqual(t.token_id, token_id),
      );
      let amount = 0;
      let to = "";
      let from = "";
      if (!token) {
        logger.warn(`No token found for ${token_id} on ${chain.domain}`);
        continue;
      }
      switch (event.event_id) {
        case "Withdrawn":
          from = address;
          amount -=
            getPropertyValue(["amount", "balance"], event) *
            10 ** -token.decimals;
          break;
        case "Deposited":
          to = address;
          amount +=
            getPropertyValue(["amount", "balance"], event) *
            10 ** -token.decimals;
          break;
        default:
          continue;
      }
      this.update(
        portfolioMovements,
        event,
        token.symbol,
        token.unique_id,
        to,
        from,
        amount,
      );
    }
    logger.info(
      `Exit BalancesChangesService.fetchTokenMovements for ${chain.domain} and ${address} with ${tokenEventDetails.length} entries`,
    );
  }
}
