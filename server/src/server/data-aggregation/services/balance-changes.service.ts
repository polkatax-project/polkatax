import { convertToCanonicalAddress } from "../../../common/util/convert-to-canonical-address";
import { isVeryCloseTo } from "../../../common/util/is-very-close-to";
import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { Asset } from "../../blockchain/substrate/model/asset";
import { MultiLocation } from "../../blockchain/substrate/model/multi-location";
import { Transfer } from "../../blockchain/substrate/model/raw-transfer";
import {
  EventDetails,
  SubscanEvent,
} from "../../blockchain/substrate/model/subscan-event";
import { TransactionDetails } from "../../blockchain/substrate/model/transaction";
import { DataPlatformBalanceEventsService } from "../../data-platform-api/data-platform-balance-events.service";
import { logger } from "../../logger/logger";
import { determineForeignAsset } from "../helper/determine-foreign-asset";
import { extractAssethubAsset } from "../helper/extract-assethub-asset";
import { readHydratinEvmLog } from "../helper/read-hydration-evm-log";
import { applyTreasuryAwardedAdjustment } from "../helper/treasury-awarded-adjustement";
import { FetchPortfolioMovementsRequest } from "../model/fetch-portfolio-movements.request";
import { PortfolioMovement } from "../model/portfolio-movement";
import {
  extractAddress,
  getPropertyValue,
  mapKeyToCanonicalAddress,
} from "./special-event-processing/helper";
import isEqual from "lodash.isequal";

const movementExistsAlready = (
  portfolioMovements: PortfolioMovement[],
  extrinsic_index: string,
  unique_id: string,
  amount: number,
) => {
  const transfers =
    portfolioMovements.find((p) => p.extrinsic_index === extrinsic_index)
      ?.transfers || [];
  return transfers.find(
    (t) => t.asset_unique_id === unique_id && isVeryCloseTo(t.amount, amount),
  );
};

export class BalanceChangesService {
  constructor(
    private subscanService: SubscanService,
    private dataPlatformBalanceEventsService: DataPlatformBalanceEventsService,
  ) {}

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
      request.minDate,
      request.maxDate,
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
      (t) =>
        t.timestamp >= request.minDate &&
        t.timestamp <= request.maxDate &&
        t.from !== t.to,
    );
    this.addToPortFolioMovements(portfolioMovements, transfers, isMyAccount);

    if (
      request.chain.domain === "hydration" ||
      request.chain.domain === "basilisk"
    ) {
      await this.fetchHydrationReferralsClaimed(
        request.chain.domain,
        request.chain.token,
        subscanEvents,
        transactions,
        portfolioMovements,
      );
      await this.fetchHydrationBroadcastSwapped3(
        request.chain.domain,
        request.address,
        subscanEvents,
        transactions,
        portfolioMovements,
        tokens,
      );
      await this.fetchHydrationEvmLogs(
        request.chain,
        request.address,
        subscanEvents,
        transactions,
        portfolioMovements,
      );
    }

    await this.fetchDelegatedStakingMigratedDelegation(
      request.chain,
      request.address,
      subscanEvents,
      transactions,
      portfolioMovements,
    );

    portfolioMovements = portfolioMovements.sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    /**
     * Fix for 20390400-0. There's a deposit and transfer -> duplicate
     */
    applyTreasuryAwardedAdjustment(portfolioMovements, subscanEvents);

    logger.info(
      `Exit fetchAllBalanceChanges for ${request.chain.domain} and ${request.address} with ${portfolioMovements.length} entries`,
    );
    return portfolioMovements;
  }

  private async fetchHydrationReferralsClaimed(
    chain: string,
    token: string,
    subscanEvents: SubscanEvent[],
    transactions: TransactionDetails[],
    portfolioMovements: PortfolioMovement[],
  ) {
    const eventDetails = await this.fetchMissingEventDetails(
      chain,
      subscanEvents,
      transactions,
      "referrals",
      ["Claimed"],
    );
    const nativeTokenDecimals =
      await this.subscanService.fetchNativeToken(chain);
    eventDetails.forEach((event) => {
      const address = extractAddress("who", event);
      const referrerRewards = getPropertyValue("referrer_rewards", event) ?? 0;
      const tradeRewards = getPropertyValue("trade_rewards", event) ?? 0;
      const amountRaw = Number(referrerRewards) + Number(tradeRewards);
      const amount =
        Number(amountRaw) / 10 ** nativeTokenDecimals.token_decimals;
      const movement = portfolioMovements.find(
        (p) => p.extrinsic_index === event.extrinsic_index,
      );
      const correspondingTransfer = movement?.transfers?.find(
        (t) =>
          isVeryCloseTo(t.amount, amount) &&
          t.symbol === token &&
          t.to === address,
      );
      if (!correspondingTransfer) {
        this.update(
          portfolioMovements,
          event,
          token,
          token,
          address,
          undefined,
          amount,
        );
      }
    });
  }

  private async fetchHydrationBroadcastSwapped3(
    chain: string,
    address: string,
    subscanEvents: SubscanEvent[],
    transactions: TransactionDetails[],
    portfolioMovements: PortfolioMovement[],
    assets: Asset[],
  ) {
    const eventDetails = await this.fetchMissingEventDetails(
      chain,
      subscanEvents,
      transactions,
      "broadcast",
      ["Swapped3", "Swapped2"],
    );
    for (const event of eventDetails) {
      const transfers =
        portfolioMovements.find(
          (p) => p.extrinsic_index === event.extrinsic_index,
        )?.transfers || [];

      const swapper = extractAddress("swapper", event);
      if (swapper !== address) {
        continue;
      }
      const inputs = getPropertyValue("inputs", event) ?? [];
      const feesRaw = getPropertyValue("fees", event) ?? [];
      const fees = [];
      for (const fee of feesRaw) {
        const token = assets.find((a) => a.token_id === fee.asset);
        const amount = fee.amount / 10 ** token.decimals;
        if (fees.length === 0) {
          fees.push({ amount, token });
        }
      }

      for (const input of inputs) {
        const token = assets.find((a) => a.token_id === input.asset);
        let amount = -(input.amount / 10 ** token.decimals);
        if (
          transfers.find(
            (t) =>
              t.asset_unique_id === token.unique_id &&
              isVeryCloseTo(t.amount, amount),
          )
        ) {
          continue;
        }
        fees
          .filter((f) => f.token.unique_id === token.unique_id)
          .forEach((f) => (amount -= f.amount));
        const movementExists = transfers.find(
          (t) =>
            t.asset_unique_id === token.unique_id &&
            isVeryCloseTo(t.amount, amount),
        );
        if (!movementExists) {
          this.update(
            portfolioMovements,
            event,
            token.symbol,
            token.unique_id,
            undefined,
            address,
            amount,
          );
        }
      }

      const outputs = getPropertyValue("outputs", event) ?? 0;
      for (const output of outputs) {
        const token = assets.find((a) => a.token_id === output.asset);
        const amount = output.amount / 10 ** token.decimals;
        const movementExists = transfers.find(
          (t) =>
            t.asset_unique_id === token.unique_id &&
            isVeryCloseTo(t.amount, amount),
        );
        if (!movementExists) {
          this.update(
            portfolioMovements,
            event,
            token.symbol,
            token.unique_id,
            address,
            undefined,
            amount,
          );
        }
      }
    }
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
      const who = extractAddress("who", event);
      if (who === address) {
        const route: { col1: any; col2: string }[] = getPropertyValue(
          "path",
          event,
        );
        for (let idx of [0, route.length - 1]) {
          const entry = route[idx];
          const token = extractAssethubAsset(entry.col1, tokens);
          if (!token) {
            logger.warn(
              `Could not extract token in assetconversion with id ${entry.col1}`,
            );
            continue;
          }
          const amount =
            ((idx === 0 ? -1 : 1) * Number(entry.col2)) / 10 ** token.decimals;
          if (
            !movementExistsAlready(
              portfolioMovements,
              event.extrinsic_index,
              token.unique_id,
              amount,
            )
          ) {
            this.update(
              portfolioMovements,
              event,
              token.symbol,
              token.unique_id,
              amount < 0 ? who : undefined,
              amount > 0 ? who : undefined,
              amount,
            );
          }
        }
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
    to: string,
    from: string,
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

  private async fetchMissingEventDetails(
    chain: string,
    events: SubscanEvent[],
    transactions: TransactionDetails[],
    moduleId: string,
    eventIds: string[],
    existingEventDetails: Partial<EventDetails>[] = [],
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
    existingEventDetails.forEach((e) =>
      eventIdxAlreadyAvailable.add(e.event_index),
    );

    const eventsToFetch = events.filter(
      (e) =>
        relevantEventIdxs.has(e.event_index) &&
        !eventIdxAlreadyAvailable.has(e.event_index),
    );

    const eventDetails: EventDetails[] =
      await this.subscanService.fetchEventDetails(chain, eventsToFetch);
    eventDetailsFromTx.forEach((e) => eventDetails.push(e));
    const idsAlreadyAvailable = eventDetails.map((e) => e.event_index);
    existingEventDetails
      .filter((e) => !idsAlreadyAvailable.includes(e.event_index))
      .forEach((e) => eventDetails.push(e as EventDetails));
    return eventDetails;
  }

  async fetchBalanceMovements(
    chain: { domain: string; token: string },
    address: string,
    events: SubscanEvent[],
    transactions: TransactionDetails[],
    portfolioMovements: PortfolioMovement[],
    minDate: number,
    maxDate: number,
  ): Promise<void> {
    logger.info(
      `Entry BalancesChangesService.fetchBalanceMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`,
    );
    const platformBalanceEvents =
      process.env["USE_DATA_PLATFORM_API_FOR_BALANCE_MOVEMENTS"] === "true" &&
      (chain.domain === "kusama" || chain.domain === "polkadot")
        ? await this.dataPlatformBalanceEventsService.fetchBalanceEvents(
            address,
            chain.domain,
            minDate,
            maxDate,
          )
        : [];
    const eventDetails = await this.fetchMissingEventDetails(
      chain.domain,
      events,
      transactions,
      "balances",
      [
        "Withdraw",
        "Burned",
        "Deposit",
        "Minted",
        "ReserveRepatriated",
        "Slashed",
      ],
      platformBalanceEvents,
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
        case "Slashed":
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

  async fetchCurrencyMovements(
    chain: { domain: string; token: string },
    address: string,
    events: SubscanEvent[],
    transactions: TransactionDetails[],
    portfolioMovements: PortfolioMovement[],
  ): Promise<void> {
    logger.info(
      `Entry BalancesChangesService.fetchCurrencyMovements for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`,
    );
    const assets = await this.subscanService.scanTokens(chain.domain);
    const eventDetails = await this.fetchMissingEventDetails(
      chain.domain,
      events,
      transactions,
      "currencies",
      ["Withdrawn", "Deposited", "Transferred"],
    );
    for (const event of eventDetails) {
      const assetId = getPropertyValue("currency_id", event);
      const asset = assets.find((a) => a.token_id == assetId);
      if (!asset || asset.asset_id === chain.token) {
        continue;
      }
      let amount = 0;
      let to = undefined;
      let from = undefined;
      switch (event.event_id) {
        case "Withdrawn":
          amount -= getPropertyValue("amount", event) * 10 ** -asset.decimals;
          from = address;
          break;
        case "Deposited":
          to = address;
          amount += getPropertyValue("amount", event) * 10 ** -asset.decimals;
          break;
        case "Transferred":
          to = mapKeyToCanonicalAddress(getPropertyValue("to", event));
          from = mapKeyToCanonicalAddress(getPropertyValue("from", event));
          amount =
            (to === address ? 1 : -1) *
            getPropertyValue("amount", event) *
            10 ** -asset.decimals;
          break;
        default:
          continue;
      }
      const existingTransfers =
        portfolioMovements.find(
          (p) => p.extrinsic_index === event.extrinsic_index,
        )?.transfers ?? [];
      const existsAlready = existingTransfers.find(
        (t) =>
          t.to === to &&
          t.from === from &&
          isVeryCloseTo(amount, t.amount) &&
          t.asset_unique_id === asset.unique_id,
      );
      if (!existsAlready) {
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
    }
    logger.info(
      `Exit BalancesChangesService.fetchCurrencyMovements for ${chain.domain} and ${address}} with ${eventDetails.length} entries`,
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
            10 ** -foreignAsset.decimals;
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

  async fetchDelegatedStakingMigratedDelegation(
    chain: { domain: string; token: string },
    address: string,
    events: SubscanEvent[],
    transactions: TransactionDetails[],
    portfolioMovements: PortfolioMovement[],
  ): Promise<void> {
    logger.info(
      `Entry BalancesChangesService.fetchDelegatedStakingMigratedDelegation for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`,
    );
    const eventDetails = await this.fetchMissingEventDetails(
      chain.domain,
      events,
      transactions,
      "delegatedstaking",
      ["MigratedDelegation", "Released"],
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
        case "MigratedDelegation":
          to = extractAddress("delegator", event);
          amount = getPropertyValue("amount", event) * 10 ** -decimals;
          break;
        case "Released":
          from = extractAddress("delegator", event);
          amount = -getPropertyValue("amount", event) * 10 ** -decimals;
          break;
      }
      if (to === address || from === address) {
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
    }
    logger.info(
      `Exit BalancesChangesService.fetchDelegatedStakingMigratedDelegation for ${chain.domain} and ${address}} with ${eventDetails.length} entries`,
    );
  }

  async fetchHydrationEvmLogs(
    chain: { domain: string; token: string },
    address: string,
    events: SubscanEvent[],
    transactions: TransactionDetails[],
    portfolioMovements: PortfolioMovement[],
  ): Promise<void> {
    logger.info(
      `Entry BalancesChangesService.fetchHydrationEvmLogs for ${chain.domain} and ${address}. SubscanEvents: ${events.length}`,
    );
    const eventDetails = transactions.flatMap((t) =>
      t.event.filter((e) => e.module_id === "evm" && e.event_id === "Log"),
    );
    const tokens = await this.subscanService.scanTokens(chain.domain);
    const hollar = tokens.find(
      (t) =>
        t.unique_id ===
        "asset_registry/aac89c40628a35265f632940b678104349122a9f",
    );
    const HUSDT = tokens.find(
      (t) =>
        t.unique_id ===
        "asset_registry/13d27f12a8581ff3e9bb196b07e1dd3841927085",
    );
    for (const event of eventDetails) {
      try {
        const data = readHydratinEvmLog(event);
        if (data) {
          const token =
            tokens.find((t) => data.tokenId && t.token_id === data.tokenId) ??
            (data.reserve === "0x531a654d1696ED52e7275A8cede955E82620f99a"
              ? hollar
              : undefined);
          data.tokenSymbol = token?.symbol;
          let correspondingAToken = tokens.find(
            (t) => token.symbol && t.symbol === "a" + token.symbol,
          );
          // 2-Pool-USDT maps to HUSDT token
          if (
            token.unique_id ===
            "asset_registry/6c505df96f1faab539199949572820b2c90f6959"
          ) {
            correspondingAToken = HUSDT;
          }
          switch (data.name) {
            case "Supply":
              const amount =
                Math.abs(Number(data.amount)) *
                10 ** -(correspondingAToken?.decimals ?? 1);
              if (
                correspondingAToken &&
                !movementExistsAlready(
                  portfolioMovements,
                  event.extrinsic_index,
                  correspondingAToken.unique_id,
                  amount,
                )
              ) {
                this.update(
                  portfolioMovements,
                  event,
                  correspondingAToken.symbol,
                  correspondingAToken.unique_id,
                  address,
                  undefined,
                  amount,
                );
              }
              break;
            case "Withdraw":
              const withDrawAmount =
                -Math.abs(Number(data.amount)) *
                10 ** -(correspondingAToken?.decimals ?? 1);
              if (
                correspondingAToken &&
                !movementExistsAlready(
                  portfolioMovements,
                  event.extrinsic_index,
                  correspondingAToken.unique_id,
                  withDrawAmount,
                )
              ) {
                this.update(
                  portfolioMovements,
                  event,
                  correspondingAToken.symbol,
                  correspondingAToken.unique_id,
                  undefined,
                  address,
                  withDrawAmount,
                );
              }
              break;
            case "Borrow":
              const borrowAount =
                Math.abs(Number(data.amount)) * 10 ** -(token?.decimals ?? 1);
              if (
                token &&
                !movementExistsAlready(
                  portfolioMovements,
                  event.extrinsic_index,
                  token.unique_id,
                  borrowAount,
                )
              ) {
                this.update(
                  portfolioMovements,
                  event,
                  token.symbol,
                  token.unique_id,
                  address,
                  undefined,
                  borrowAount,
                );
              }
              break;
            case "Repay":
              const repayAmount =
                -Math.abs(Number(data.amount)) * 10 ** -(token?.decimals ?? 1);
              if (
                token &&
                !movementExistsAlready(
                  portfolioMovements,
                  event.extrinsic_index,
                  token.unique_id,
                  repayAmount,
                )
              ) {
                this.update(
                  portfolioMovements,
                  event,
                  token.symbol,
                  token.unique_id,
                  undefined,
                  address,
                  repayAmount,
                );
              }
          }
        }
      } catch (error) {
        // nothing to do.
      }
    }
    logger.info(
      `Entry BalancesChangesService.fetchHydrationEvmLogs for ${chain.domain} and ${address}.`,
    );
  }
}
