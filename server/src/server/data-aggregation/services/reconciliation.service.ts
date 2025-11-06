import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { PortfolioMovement } from "../model/portfolio-movement";
import { TransactionDetails } from "../../blockchain/substrate/model/transaction";
import { EventDerivedTransfer } from "../model/event-derived-transfer";
import {
  XcmAssetMovement,
  XcmTransfer,
} from "../../blockchain/substrate/model/xcm-transfer";
import { Asset } from "../../blockchain/substrate/model/asset";
import { SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { StakingReward } from "../../blockchain/substrate/model/staking-reward";
import { logger } from "../../logger/logger";
import { extractXcmFees } from "./special-event-processing/extract-xcm-fees";
import { isVeryCloseTo } from "../../../common/util/is-very-close-to";
import * as subscanChains from "../../../../res/gen/subscan-chains.json";

const getDecimals = (assetUniqueId: string, tokens: Asset[]) => {
  return tokens.find((t) => t.unique_id === assetUniqueId)?.decimals;
};

const isCloseTo = (a: number, b: number) => {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  const norm = Math.abs(a) + Math.abs(b);
  return norm === 0 ? diff < 1e-2 : diff / norm < 1e-2;
};

export class ReconciliationService {
  constructor(private subscanService: SubscanService) {}

  async reconcile(
    chain: { domain: string; token: string },
    address: string,
    portfolioMovements: PortfolioMovement[],
    transactions: TransactionDetails[],
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

    const indexedTx: Record<string, TransactionDetails> = {};
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
      this.matchTransactionFee(
        chain.token,
        address,
        portfolioMovement,
        tokens,
        indexedTx,
      );
      this.matchStakingRewards(portfolioMovement, indexedStakingRewards, chain);
      this.matchSemanticTransfers(
        portfolioMovement,
        indexedTransfers,
        indexedOutgoingXcmTransfers,
      );
      this.matchIncomingXcmTransfers(
        chain.domain,
        portfolioMovement,
        xcmTransfers,
      );
      this.attachEvents(portfolioMovement, indexedEvents);
      this.handleXcmFees(portfolioMovement, address, indexedTx, tokens);
    }

    /**
     * Verify all staking rewards where matched
     */
    stakingRewards.forEach((s) => {
      if (!s["tainted"]) {
        logger.warn(s, `Unused staking reward for ${chain.domain}`);
      }
    });

    portfolioMovements.forEach((p) =>
      p.transfers.forEach((t) => {
        delete t["reconciled"];
        delete t["tainted"];
      }),
    );
  }

  async handleXcmFees(
    portfolioMovement: PortfolioMovement,
    address: string,
    indexedTx: Record<string, TransactionDetails>,
    tokens: Asset[],
  ) {
    const tx = indexedTx[portfolioMovement.extrinsic_index];
    if (!tx) {
      return;
    }
    const fees = extractXcmFees(
      address,
      indexedTx[portfolioMovement.extrinsic_index],
    );
    if (fees > 0) {
      const xcmFeeTransfer = portfolioMovement.transfers.find((t) =>
        isVeryCloseTo(
          -t.amount * 10 ** getDecimals(t.asset_unique_id, tokens),
          fees,
        ),
      );
      if (xcmFeeTransfer) {
        portfolioMovement.xcmFee = Math.abs(xcmFeeTransfer.amount);
        portfolioMovement.xcmFeeTokenSymbol = xcmFeeTransfer.symbol;
        portfolioMovement.xcmFeeTokenUniqueId = xcmFeeTransfer.asset_unique_id;
        portfolioMovement.transfers = portfolioMovement.transfers.filter(
          (t) => t !== xcmFeeTransfer,
        );
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
    chain: string,
    portfolioMovement: PortfolioMovement,
    xcmTransfers: XcmTransfer[],
  ) {
    const relayChain = subscanChains.chains.find(
      (c) => c.domain === chain,
    )?.relay;
    const remainingTransfers = portfolioMovement.transfers.filter(
      (t) => !t["reconciled"],
    );
    const relevantXcmTransfers = xcmTransfers.filter(
      (xcm) =>
        xcm.timestamp >=
          portfolioMovement.timestamp -
            (relayChain === xcm.relayChain ? 20_000 : 180_000) &&
        xcm.timestamp <= portfolioMovement.timestamp &&
        xcm.transfers.some((t) => !t.outgoing && !t["tainted"]),
    );
    for (let transfer of remainingTransfers) {
      const matchingXcm = relevantXcmTransfers.find((xcm) =>
        xcm.transfers.some(
          (t) =>
            !t["tainted"] &&
            isCloseTo(t.amount, transfer.amount) &&
            t.symbol.toUpperCase().replace(/^XC/, "") ===
              transfer.symbol.toUpperCase().replace(/^XC/, ""),
        ),
      );
      const matchingTransfer = (matchingXcm?.transfers ?? []).find(
        (t) =>
          !t["tainted"] &&
          isCloseTo(t.amount, transfer.amount) &&
          t.symbol.toUpperCase().replace(/^XC/, "") ===
            transfer.symbol.toUpperCase().replace(/^XC/, ""),
      );
      if (matchingTransfer) {
        matchingTransfer["tainted"] = true;
        transfer["reconciled"] = true;
        transfer.module = "xcm";
        transfer.price = matchingTransfer.price;
        transfer.fiatValue = matchingTransfer.fiatValue;
        transfer.to = matchingTransfer.to ?? transfer.to;
        transfer.from = matchingTransfer.from ?? transfer.from;
        transfer.fromChain = matchingTransfer.fromChain;
        transfer.toChain = matchingTransfer.destChain;
        transfer.semanticGroupId = matchingTransfer.xcmMessageHash;
        transfer.label = "XCM transfer";
        transfer.xcmMessageHash = matchingTransfer.xcmMessageHash;
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
        transfer.semanticEventIndex = (
          matchingSemanticTransfer as EventDerivedTransfer
        ).original_event_index;
        transfer.semanticGroupId =
          (matchingSemanticTransfer as EventDerivedTransfer).semanticGroupId ??
          (matchingSemanticTransfer as XcmAssetMovement).xcmMessageHash;
        transfer.label =
          (matchingSemanticTransfer as EventDerivedTransfer)?.label ??
          (matchingSemanticTransfer.module === "xcm"
            ? "XCM transfer"
            : undefined);
        transfer["reconciled"] = true;
        matchingSemanticTransfer["tainted"] = true;
        transfer.xcmMessageHash = (
          matchingSemanticTransfer as XcmAssetMovement
        ).xcmMessageHash;
        if (transfer.label === "XCM transfer") {
          transfer.to = matchingSemanticTransfer.to ?? transfer.to;
          transfer.from = matchingSemanticTransfer.from ?? transfer.from;
        }
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
        }
      }
    }
  }

  matchTransactionFee(
    nativeToken: string,
    wallet: string,
    portfolioMovement: PortfolioMovement,
    tokens: Asset[],
    indexedTx: Record<string, TransactionDetails>,
  ) {
    /**
     * Using transaction fee information
     */
    const matchingTx = indexedTx[portfolioMovement.extrinsic_index];
    if (!matchingTx) {
      return;
    }
    portfolioMovement.callModule = matchingTx.callModule;
    portfolioMovement.callModuleFunction = matchingTx.callModuleFunction;
    /**
     * Fee event is event with lowest idx.
     */
    let feePaymentEvent = matchingTx.event[0];
    matchingTx.event.forEach((e) => {
      if (e.event_idx < feePaymentEvent.event_idx) {
        feePaymentEvent = e;
      }
    });
    if (
      (feePaymentEvent.module_id === "tokens" &&
        feePaymentEvent.event_id === "Transfer") ||
      (feePaymentEvent.module_id === "balances" &&
        feePaymentEvent.event_id === "Withdraw") ||
      (feePaymentEvent.module_id === "tokens" &&
        feePaymentEvent.event_id === "Withdrawn") ||
      (feePaymentEvent.module_id === "assets" &&
        feePaymentEvent.event_id === "Withdrawn") ||
      (feePaymentEvent.module_id === "foreignassets" &&
        feePaymentEvent.event_id === "Withdrawn")
    ) {
      const feePayment = portfolioMovement.transfers.find(
        (t) => t.event_index === feePaymentEvent.event_index,
      );
      if (feePayment) {
        portfolioMovement.feeUsed = -feePayment.amount;
        portfolioMovement.feeTokenSymbol = feePayment.symbol;
        portfolioMovement.feeTokenUniqueId = feePayment.asset_unique_id;
        portfolioMovement.transfers = portfolioMovement.transfers.filter(
          (t) => t !== feePayment,
        );
      }
    } else {
      const transferMatchingFee = matchingTx
        ? portfolioMovement.transfers.find(
            (t) =>
              !t["reconciled"] &&
              isVeryCloseTo(
                -t.amount * 10 ** getDecimals(t.asset_unique_id, tokens),
                matchingTx.fee,
              ),
          )
        : undefined;
      if (transferMatchingFee) {
        const decimals = getDecimals(
          transferMatchingFee.asset_unique_id,
          tokens,
        );
        portfolioMovement.feeUsed = -transferMatchingFee.amount;
        portfolioMovement.tip = matchingTx.tip / 10 ** decimals;
        portfolioMovement.feeTokenSymbol = transferMatchingFee.symbol;
        portfolioMovement.feeTokenUniqueId =
          transferMatchingFee.asset_unique_id;
        portfolioMovement.transfers = portfolioMovement.transfers.filter(
          (t) => t !== transferMatchingFee,
        );
      } else {
        // add fee to a withdrawal event matching the token
        logger.warn(
          `First event of tx is not withdraw event! ${portfolioMovement.extrinsic_index} and no transfer matching fee found`,
        );
        const decimals = getDecimals(nativeToken, tokens);
        const withDrawalOfNativeToken = portfolioMovement.transfers.find(
          (t) =>
            t.asset_unique_id === nativeToken &&
            t.from === wallet &&
            !t.to &&
            -t.amount > matchingTx.fee / 10 ** decimals,
        );
        if (withDrawalOfNativeToken) {
          portfolioMovement.feeUsed = matchingTx.fee / 10 ** decimals;
          withDrawalOfNativeToken.amount += portfolioMovement.feeUsed;
          portfolioMovement.tip = matchingTx.tip / 10 ** decimals;
          portfolioMovement.feeTokenSymbol = nativeToken;
          portfolioMovement.feeTokenUniqueId = nativeToken;
        }
      }
    }

    const transferMatchingFeeRepayment = portfolioMovement.transfers.find(
      (t) =>
        !t["reconciled"] &&
        (matchingTx?.feeUsed ?? 0) > 0 &&
        isVeryCloseTo(
          t.amount * 10 ** getDecimals(t.asset_unique_id, tokens),
          matchingTx?.fee - matchingTx?.feeUsed,
        ),
    );
    if (transferMatchingFeeRepayment) {
      portfolioMovement.transfers = portfolioMovement.transfers.filter(
        (t) => t !== transferMatchingFeeRepayment,
      );
      portfolioMovement.feeUsed -= transferMatchingFeeRepayment.amount;
    }

    if (matchingTx.tip ?? 0 > 0) {
      const matchingTip = portfolioMovement.transfers.find(
        (t) => !t["reconciled"] && isVeryCloseTo(-t.amount, matchingTx.tip),
      );
      if (matchingTip) {
        portfolioMovement.transfers = portfolioMovement.transfers.filter(
          (t) => t !== matchingTip,
        );
      }
    }
  }
}
