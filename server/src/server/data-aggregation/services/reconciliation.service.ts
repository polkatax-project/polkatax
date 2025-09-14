import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { PortfolioMovement } from "../model/portfolio-movement";
import { Transaction } from "../../blockchain/substrate/model/transaction";
import { EventDerivedTransfer } from "../model/event-derived-transfer";
import {
  XcmAssetMovement,
  XcmTransfer,
} from "../../blockchain/substrate/model/xcm-transfer";
import { Asset } from "../../blockchain/substrate/model/asset";
import { SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { StakingReward } from "../../blockchain/substrate/model/staking-reward";
import { logger } from "../../logger/logger";
import { CryptoCurrencyPricesService } from "./crypto-currency-prices.service";
import { lookupCoingeckoId } from "../helper/lookup-coingecko-id";
import { formatDate } from "../../../common/util/date-utils";

const getDecimals = (assetUniqueId: string, tokens: Asset[]) => {
  return tokens.find((t) => t.unique_id === assetUniqueId)?.decimals;
};

const isVeryCloseTo = (a: number, b: number) => {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  const norm = Math.abs(a) + Math.abs(b);
  return norm === 0 ? diff < 1e-6 : diff / norm < 1e-6;
};

export class ReconciliationService {
  constructor(
    private subscanService: SubscanService,
    private cryptoCurrencyPricesService: CryptoCurrencyPricesService,
  ) {}

  async reconcile(
    chain: { domain: string; token: string },
    portfolioMovements: PortfolioMovement[],
    transactions: Transaction[],
    transfers: EventDerivedTransfer[],
    xcmTransfers: XcmTransfer[],
    stakingRewards: StakingReward[],
    events: SubscanEvent[],
  ) {
    const tokens = await this.subscanService.scanTokensAndAssets(chain.domain);
    if (!tokens.find((t) => t.native)) {
      tokens.push({
        id: chain.token,
        asset_id: chain.token,
        symbol: chain.token,
        unique_id: chain.token,
        decimals: (await this.subscanService.fetchNativeToken(chain.domain))
          .token_decimals,
      });
    }

    const indexedTx: Record<string, Transaction> = {};
    transactions.forEach((tx) => {
      indexedTx[tx.extrinsic_index] = tx;
    });

    const indexedTransfers: Record<string, EventDerivedTransfer[]> = {};
    transfers.forEach((transfer) => {
      indexedTransfers[transfer.extrinsic_index] =
        indexedTransfers[transfer.extrinsic_index] ?? [];
      indexedTransfers[transfer.extrinsic_index].push(transfer);
    });

    const indexedStakingRewards: Record<string, StakingReward[]> = {};
    stakingRewards
      .filter((s) => !!s.extrinsic_index)
      .forEach((reward) => {
        indexedStakingRewards[reward.extrinsic_index] =
          indexedStakingRewards[reward.extrinsic_index] ?? [];
        indexedStakingRewards[reward.extrinsic_index].push(reward);
      });

    const indexedEvents: Record<string, SubscanEvent[]> = {};
    events
      .filter((e) => !!e.extrinsic_index)
      .forEach((event) => {
        indexedEvents[event.extrinsic_index] =
          indexedEvents[event.extrinsic_index] ?? [];
        indexedEvents[event.extrinsic_index].push(event);
      });

    const indexedOutgoingXcmTransfers: Record<number, XcmTransfer[]> = {};
    xcmTransfers
      .filter((x) => x.transfers[0].outgoing)
      .forEach((x) => {
        indexedOutgoingXcmTransfers[x.timestamp] =
          indexedOutgoingXcmTransfers[x.timestamp] ?? [];
        indexedOutgoingXcmTransfers[x.timestamp].push(x);
      });

    for (let portfolioMovement of portfolioMovements) {
      this.matchTransactionFee(portfolioMovement, tokens, indexedTx);
      this.matchStakingRewards(portfolioMovement, indexedStakingRewards, chain);
      this.matchSemanticTransfers(
        portfolioMovement,
        indexedTransfers,
        indexedOutgoingXcmTransfers,
      );
      this.matchIncomingXcmTransfers(portfolioMovement, xcmTransfers);
      this.attachEvents(portfolioMovement, indexedEvents);
      this.handlePossibleXcmFees(portfolioMovement);
    }

    /**
     * Verify all staking rewards where machted
     */
    stakingRewards.forEach((s) => {
      if (!s["tainted"]) {
        logger.warn(s, `Unused staking reward for ${chain.domain}`);
      }
    });
  }

  async handlePossibleXcmFees(portfolioMovement: PortfolioMovement) {
    /**
     * TODO: find a way to obtain the actual fees!
     * e.g. https://assethub-polkadot.subscan.io/event?module=polkadotxcm&event_id=FeesPaid
     */
    if (portfolioMovement.label === "XCM transfer") {
      const unlabelledTransfers = portfolioMovement.transfers.filter(
        (t) => !t.label && t.amount < 0,
      );
      if (unlabelledTransfers.length === 1) {
        const coingeckoId = lookupCoingeckoId(unlabelledTransfers[0].symbol);
        const prices =
          await this.cryptoCurrencyPricesService.fetchHistoricalPrices(
            coingeckoId,
            "USD",
          );
        const priceOnDay =
          prices.quotes[formatDate(new Date(portfolioMovement.timestamp))];
        if (priceOnDay && priceOnDay * -unlabelledTransfers[0].amount < 2) {
          // 2 USD max fee assumed.
          portfolioMovement.xcmFee = Math.abs(unlabelledTransfers[0].amount);
          portfolioMovement.xcmFeeTokenSymbol = unlabelledTransfers[0].symbol;
          portfolioMovement.xcmFeeFiat = portfolioMovement.xcmFee * priceOnDay;
          portfolioMovement.xcmFeeTokenUniqueId =
            unlabelledTransfers[0].asset_unique_id;
          portfolioMovement.transfers = portfolioMovement.transfers.filter(
            (t) => t !== unlabelledTransfers[0],
          );
        }
      }
    }
  }

  attachEvents(
    portfolioMovement: PortfolioMovement,
    indexedEvents: Record<string, SubscanEvent[]>,
  ) {
    const matchingEvents = indexedEvents[portfolioMovement.extrinsic_index];
    portfolioMovement.events = (matchingEvents ?? []).map((e) => ({
      eventId: e.event_id,
      moduleId: e.module_id,
      eventIndex: e.event_index,
    }));
  }

  matchIncomingXcmTransfers(
    portfolioMovement: PortfolioMovement,
    xcmTransfers: XcmTransfer[],
  ) {
    const remainingTransfers = portfolioMovement.transfers.filter(
      (t) => !t["reconciled"],
    );
    const timespan = [
      portfolioMovement.timestamp - 20_000,
      portfolioMovement.timestamp,
    ]; // up until 20 seconds ago.
    const relevantXcmTransfers = xcmTransfers.filter(
      (xcm) =>
        xcm.timestamp >= timespan[0] &&
        xcm.timestamp <= timespan[1] &&
        xcm.transfers.some((t) => !t.outgoing),
    );
    for (let transfer of remainingTransfers) {
      const matchingXcm = relevantXcmTransfers.find((xcm) =>
        xcm.transfers.some(
          (t) =>
            !t["tainted"] &&
            isVeryCloseTo(t.amount, transfer.amount) &&
            t.symbol.toUpperCase() === transfer.symbol.toUpperCase(),
        ),
      );
      const matchingTransfer = (matchingXcm?.transfers ?? []).find(
        (t) =>
          !t["tainted"] &&
          isVeryCloseTo(t.amount, transfer.amount) &&
          t.symbol.toUpperCase() === transfer.symbol.toUpperCase(),
      );
      if (matchingTransfer) {
        matchingTransfer["tainted"] = true;
        transfer["reconciled"] = true;
        transfer.module = "xcm";
        transfer.price = matchingTransfer.price;
        transfer.fiatValue = matchingTransfer.fiatValue;
        transfer.to = transfer.to ?? matchingTransfer.to;
        transfer.from = transfer.from ?? matchingTransfer.from;
        transfer.fromChain = matchingTransfer.fromChain;
        transfer.toChain = matchingTransfer.destChain;
        transfer.semanticGroupId = matchingTransfer.messageHash;
        transfer.label = "XCM transfer";
        portfolioMovement.label = portfolioMovement.label ?? transfer.label;
      }
    }
  }

  matchSemanticTransfers(
    portfolioMovement: PortfolioMovement,
    indexedTransfers: Record<string, EventDerivedTransfer[]>,
    indexedXcmTransfers: Record<number, XcmTransfer[]>,
  ) {
    const remainingTransfers = portfolioMovement.transfers.filter(
      (t) => !t["reconciled"],
    );
    const semanticTransfers =
      indexedTransfers[portfolioMovement.extrinsic_index] ?? [];

    for (let transfer of remainingTransfers) {
      if (transfer["reconciled"]) {
        continue;
      }
      let matchingSemanticTransfer: EventDerivedTransfer | XcmAssetMovement =
        semanticTransfers.find(
          (t) =>
            !t["tainted"] &&
            isVeryCloseTo(t.amount, transfer.amount) &&
            t.symbol.toUpperCase() === transfer.symbol.toUpperCase(),
        );
      if (!matchingSemanticTransfer) {
        const matchingXcm = (
          indexedXcmTransfers[portfolioMovement.timestamp] ?? []
        ).find((t) =>
          t.transfers.some(
            (t) => !t["tainted"] && isVeryCloseTo(t.amount, transfer.amount),
          ),
        );
        matchingSemanticTransfer = (matchingXcm?.transfers ?? []).find(
          (t) =>
            t.outgoing &&
            isVeryCloseTo(t.amount, transfer.amount) &&
            (t.symbol.toUpperCase() === transfer.symbol.toUpperCase() ||
              t.asset_unique_id === transfer.asset_unique_id),
        );
      }
      if (matchingSemanticTransfer) {
        transfer.module = matchingSemanticTransfer.module;
        transfer.price = matchingSemanticTransfer.price;
        transfer.fiatValue = matchingSemanticTransfer.fiatValue;
        transfer.to = transfer.to ?? matchingSemanticTransfer.to;
        transfer.from = transfer.from ?? matchingSemanticTransfer.from;
        transfer.fromChain = matchingSemanticTransfer.fromChain;
        transfer.toChain = matchingSemanticTransfer.destChain;
        transfer.semanticGroupId =
          (matchingSemanticTransfer as EventDerivedTransfer)
            .original_event_id ??
          (matchingSemanticTransfer as XcmAssetMovement).messageHash;
        transfer.label =
          (matchingSemanticTransfer as EventDerivedTransfer)?.label ??
          (matchingSemanticTransfer.module === "xcm"
            ? "XCM transfer"
            : undefined);
        transfer["reconciled"] = true;
        portfolioMovement.label = portfolioMovement.label ?? transfer.label;
        matchingSemanticTransfer["tainted"] = true;
      }
    }
  }

  matchStakingRewards(
    portfolioMovement: PortfolioMovement,
    indexedStakingRewards: Record<string, StakingReward[]>,
    chain: { domain: string; token: string },
  ) {
    const matchingStakingRewards =
      indexedStakingRewards[portfolioMovement.extrinsic_index] ?? [];
    const relevantMovements = portfolioMovement.transfers.filter(
      (t) => t.symbol === chain.token && !t["reconciled"],
    );
    if (matchingStakingRewards.length > 0) {
      for (let transfer of relevantMovements) {
        const matchingReward = matchingStakingRewards.find(
          (r) => isVeryCloseTo(r.amount, transfer.amount) && !r["tainted"],
        );
        if (matchingReward) {
          matchingReward["tainted"] = true;
          transfer["reconciled"] = true;
          transfer.price = matchingReward.price;
          transfer.fiatValue = matchingReward.fiatValue;
          transfer.label =
            transfer.amount > 0 ? "Staking reward" : "Staking slashed";
          transfer.semanticGroupId = transfer.label;
          portfolioMovement.label = transfer.label;
        }
      }
    }
  }

  matchTransactionFee(
    portfolioMovement: PortfolioMovement,
    tokens: Asset[],
    indexedTx: Record<string, Transaction>,
  ) {
    /**
     * Using transaction fee information
     */
    const matchingTx = indexedTx[portfolioMovement.extrinsic_index];
    portfolioMovement.callModule = matchingTx?.callModule;
    portfolioMovement.callModuleFunction = matchingTx?.callModuleFunction;
    const transferMatchingFee = matchingTx
      ? portfolioMovement.transfers.find(
          (t) =>
            !t["reconciled"] &&
            isVeryCloseTo(
              -t.amount * 10 ** getDecimals(t.asset_unique_id, tokens),
              matchingTx?.fee,
            ),
        )
      : undefined;
    if (transferMatchingFee) {
      const decimals = getDecimals(transferMatchingFee.asset_unique_id, tokens);
      portfolioMovement.feeUsed = matchingTx?.feeUsed / 10 ** decimals;
      portfolioMovement.tip = matchingTx?.tip / 10 ** decimals;
      portfolioMovement.feeTokenSymbol = transferMatchingFee.symbol;
      portfolioMovement.feeTokenUniqueId = transferMatchingFee.asset_unique_id;
      portfolioMovement.transfers = portfolioMovement.transfers.filter(
        (t) => t !== transferMatchingFee,
      );
    }

    const transferMatchingFeeRepayment = matchingTx
      ? portfolioMovement.transfers.find(
          (t) =>
            !t["reconciled"] &&
            isVeryCloseTo(
              t.amount * 10 ** getDecimals(t.asset_unique_id, tokens),
              matchingTx?.fee - matchingTx?.feeUsed,
            ),
        )
      : undefined;
    if (transferMatchingFeeRepayment) {
      portfolioMovement.transfers = portfolioMovement.transfers.filter(
        (t) => t !== transferMatchingFeeRepayment,
      );
    }

    if (transferMatchingFee && (matchingTx?.tip ?? 0) > 0) {
      const matchingTip = matchingTx
        ? portfolioMovement.transfers.find(
            (t) => !t["reconciled"] && isVeryCloseTo(-t.amount, matchingTx?.tip),
          )
        : undefined;
      if (matchingTip) {
        portfolioMovement.transfers = portfolioMovement.transfers.filter(
          (t) => t !== matchingTip,
        );
      }
    }
  }
}
