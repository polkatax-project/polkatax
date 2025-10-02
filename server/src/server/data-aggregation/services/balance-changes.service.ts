import { convertToCanonicalAddress } from "../../../common/util/convert-to-canonical-address";
import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { Asset } from "../../blockchain/substrate/model/asset";
import { MultiLocation } from "../../blockchain/substrate/model/multi-location";
import { Transfer } from "../../blockchain/substrate/model/raw-transfer";
import {
  EventDetails,
  SubscanEvent,
} from "../../blockchain/substrate/model/subscan-event";
import { TransactionDetails } from "../../blockchain/substrate/model/transaction";
import { logger } from "../../logger/logger";
import { determineForeignAsset } from "../helper/determine-foreign-asset";
import { extractAssethubAsset } from "../helper/extract-assethub-asset";
import { FetchPortfolioMovementsRequest } from "../model/fetch-portfolio-movements.request";
import { PortfolioMovement } from "../model/portfolio-movement";
import {
  extractAddress,
  getPropertyValue,
} from "./special-event-processing/helper";
import isEqual from "lodash.isequal";

export class BalanceChangesService {
  constructor(private subscanService: SubscanService) {}

  async fetchAllBalanceChanges(
    request: FetchPortfolioMovementsRequest,
    subscanEvents: SubscanEvent[],
    transactions: TransactionDetails[],
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
      transactions,
      portfolioMovements,
    );
    await this.fetchAssetMovements(
      request.chain,
      request.address,
      subscanEvents,
      transactions,
      portfolioMovements,
    );
    await this.fetchForeignAssetMovements(
      request.chain,
      request.address,
      subscanEvents,
      transactions,
      portfolioMovements,
    );
    await this.fetchTokenMovements(
      request.chain,
      request.address,
      subscanEvents,
      transactions,
      portfolioMovements,
    );

    const tokens = await this.subscanService.scanTokensAndAssets(
      request.chain.domain,
    );

    await this.fetchAssetconversionAssethub(
      request.chain.domain,
      request.address,
      subscanEvents,
      transactions,
      tokens,
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

  private async fetchAssetconversionAssethub(
    chain: string,
    address: string,
    subscanEvents: SubscanEvent[],
    transactions: TransactionDetails[],
    tokens: Asset[],
    portfolioMovements: PortfolioMovement[],
  ) {
    const assetConversionEvents = await this.fetchMissingEventDetails(
      chain,
      subscanEvents,
      transactions,
      "assetconversion",
      ["SwapExecuted"],
    );
    assetConversionEvents.forEach((event) => {
      const sender = extractAddress("who", event);
      if (sender === address) {
        const amountIn = getPropertyValue("amount_in", event);
        const route: { col1: any; col2: string }[] = getPropertyValue(
          "path",
          event,
        );
        route
          .filter((r) => r.col2 === amountIn) // r.col2 === amountOut is delibarately ignored because there's a matching deposit...
          .forEach((entry) => {
            const token = extractAssethubAsset(entry.col1, tokens);
            if (!token) {
              logger.warn(
                `Could not extract token in assetconversion with id ${entry.col1}`,
              );
            } else {
              const amount = -Number(entry.col2) / 10 ** token.decimals;
              this.update(
                portfolioMovements,
                event,
                token.symbol,
                token.unique_id,
                sender,
                undefined,
                amount,
              );
            }
          });
      }
    });
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
          eventDetails: [],
        };
        portfolioMovements.push(movement);
      }
      const canonicalToAddress = convertToCanonicalAddress(transfer.to);
      const canonicalFromAddress = convertToCanonicalAddress(transfer.from);
      movement.transfers.push({
        ...transfer,
        to: transfer.to ? canonicalToAddress : undefined,
        from: transfer.from ? canonicalFromAddress : undefined,
        amount: isMyAccount(canonicalToAddress)
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
        eventDetails: [],
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

  private async fetchMissingEventDetails(
    chain: string,
    events: SubscanEvent[],
    transactions: TransactionDetails[],
    moduleId: string,
    eventIds: string[],
  ): Promise<EventDetails[]> {
    const relevantEventIdxs = new Set(
      events
        .filter(
          (e) => e.module_id === moduleId && eventIds.includes(e.event_id),
        )
        .map((e) => e.event_index),
    );

    const eventDetailsFromTx = transactions.flatMap((t) =>
      t.event.filter((e) => relevantEventIdxs.has(e.event_index)),
    );

    const eventIdxAlreadyAvailable = new Set(
      eventDetailsFromTx.map((e) => e.event_index),
    );

    const eventsToFetch = events.filter(
      (e) =>
        relevantEventIdxs.has(e.event_index) &&
        !eventIdxAlreadyAvailable.has(e.event_index),
    );

    const eventDetails: EventDetails[] =
      await this.subscanService.fetchEventDetails(chain, eventsToFetch);
    eventDetails.forEach((e) => eventDetailsFromTx.push(e));
    return eventDetailsFromTx;
  }

  async fetchBalanceMovements(
    chain: { domain: string; token: string },
    address: string,
    events: SubscanEvent[],
    transactions: TransactionDetails[],
    portfolioMovements: PortfolioMovement[],
  ): Promise<void> {
    logger.info(
      `Entry BalancesChangesService.fetchBalanceMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`,
    );
    const eventDetails = await this.fetchMissingEventDetails(
      chain.domain,
      events,
      transactions,
      "balances",
      ["Withdraw", "Burned", "Deposit", "Minted", "ReserveRepatriated"],
    );
    const nativeToken = await this.subscanService.fetchNativeToken(
      chain.domain,
    );
    const decimals = nativeToken.token_decimals;
    for (const event of eventDetails) {
      let amount = 0;
      let to = undefined;
      let from = undefined;
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
        case "ReserveRepatriated":
          to = convertToCanonicalAddress(getPropertyValue("to", event));
          from = convertToCanonicalAddress(getPropertyValue("from", event));
          amount =
            (to === address ? 1 : -1) *
            getPropertyValue("amount", event) *
            10 ** -decimals;
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
    transactions: TransactionDetails[],
    portfolioMovements: PortfolioMovement[],
  ): Promise<void> {
    logger.info(
      `Entry BalancesChangesService.fetchAssetMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`,
    );
    const eventDetails = await this.fetchMissingEventDetails(
      chain.domain,
      events,
      transactions,
      "assets",
      ["Withdrawn", "Burned", "Deposited", "Issued"],
    );
    if (eventDetails.length === 0) {
      return;
    }
    const assets = await this.subscanService.scanAssets(chain.domain);
    if (!assets || assets.length === 0) {
      logger.warn(`fetchAssetMovements: No assets found for ${chain.domain}.`);
      return; // Moonbeam has assets events but no assets endpoint.
    }
    for (const event of eventDetails) {
      const assetId = getPropertyValue("asset_id", event);
      const asset = assets.find((a) => a.asset_id == assetId);
      let amount = 0;
      let to = undefined;
      let from = undefined;
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
      `Exit BalancesChangesService.fetchAssetMovements for ${chain.domain} and ${address} with ${eventDetails.length} entries`,
    );
  }

  async fetchForeignAssetMovements(
    chain: { domain: string; token: string },
    address: string,
    events: SubscanEvent[],
    transactions: TransactionDetails[],
    portfolioMovements: PortfolioMovement[],
  ): Promise<void> {
    logger.info(
      `Entry BalancesChangesService.fetchForeignAssetMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`,
    );
    const eventDetails = await this.fetchMissingEventDetails(
      chain.domain,
      events,
      transactions,
      "foreignassets",
      ["Withdrawn", "Burned", "Deposited", "Issued"],
    );
    if (eventDetails.length === 0) {
      return;
    }
    const foreignAssets = await this.subscanService.fetchForeignAssets(
      chain.domain,
    );

    for (const event of eventDetails) {
      const assetId: MultiLocation = getPropertyValue("asset_id", event);
      const foreignAsset = determineForeignAsset(assetId, foreignAssets);
      if (!foreignAsset) {
        logger.warn(`Foreign asset ${JSON.stringify(assetId)} not found.`);
        continue;
      }
      let amount = 0;
      let to = undefined;
      let from = undefined;
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
      `Exit BalancesChangesService.fetchForeignAssetMovements for ${chain.domain} and ${address} with ${eventDetails.length} entries`,
    );
  }

  async fetchTokenMovements(
    chain: { domain: string; token: string },
    address: string,
    events: SubscanEvent[],
    transactions: TransactionDetails[],
    portfolioMovements: PortfolioMovement[],
  ): Promise<void> {
    logger.info(
      `Entry BalancesChangesService.fetchTokenMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`,
    );
    const eventDetails = await this.fetchMissingEventDetails(
      chain.domain,
      events,
      transactions,
      "tokens",
      ["Withdrawn", "Deposited"],
    );
    if (eventDetails.length === 0) {
      return;
    }
    const tokens = await this.subscanService.scanTokens(chain.domain);
    for (const event of eventDetails) {
      const token_id = getPropertyValue("currency_id", event);
      let token = tokens.find(
        (t) => t.token_id === token_id || isEqual(t.token_id, token_id),
      );
      let amount = 0;
      let to = undefined;
      let from = undefined;
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
      `Exit BalancesChangesService.fetchTokenMovements for ${chain.domain} and ${address} with ${eventDetails.length} entries`,
    );
  }
}
