import { PortfolioMovement } from "../model/portfolio-movement";

export const addLabelsAndSemanticIds = (
  portfolioMovement: PortfolioMovement,
) => {
  preprocessNetZeroTransfers(portfolioMovement);
  annotateSwapWithFees(portfolioMovement);
  applyGovernanceVoteFeeRefund(portfolioMovement);
  annotateLiquidityRemoval(portfolioMovement);
  annotateRouterSwapRewards(portfolioMovement);
};

function annotateLiquidityRemoval(tx: any): void {
  if (
    !(tx.callModule === "xyk" && tx.callModuleFunction === "remove_liquidity")
  ) {
    return; // not our case
  }

  // find liquidity removal event
  const liqRemovedEvent = tx.events.find(
    (e: any) => e.moduleId === "xyk" && e.eventId === "LiquidityRemoved",
  );

  if (!liqRemovedEvent) {
    return; // no liquidity removal event, skip
  }

  for (const t of tx.transfers) {
    // Skip if already labeled (e.g. Existential deposit paid)
    if (t.label) continue;

    // reward detection → treasury payouts (modlpy/… or similar module address names)
    if (t.fromAddressName && t.fromAddressName.startsWith("modlpy/")) {
      t.label = "Reward";
      t.semanticEventIndex = liqRemovedEvent.eventIndex;
      t.semanticGroupId = tx.hash + "-reward";
      continue;
    }

    // all other transfers are part of liquidity removal
    t.label = "Liquidity removed";
    t.semanticEventIndex = liqRemovedEvent.eventIndex;
    t.semanticGroupId = tx.hash + "-liquidity";
  }
}

function preprocessNetZeroTransfers(tx: PortfolioMovement): void {
  if (
    !(
      tx.callModule === "router" &&
      (tx.callModuleFunction === "sell" || tx.callModuleFunction === "buy")
    )
  )
    return;

  const seen = new Set<number>();
  for (let i = 0; i < tx.transfers.length; i++) {
    if (seen.has(i)) continue;
    const a = tx.transfers[i];

    for (let j = i + 1; j < tx.transfers.length; j++) {
      if (seen.has(j)) continue;
      const b = tx.transfers[j];

      if (
        a.symbol === b.symbol &&
        Math.abs(a.amount + b.amount) < 1e-10 // cancels exactly
      ) {
        seen.add(i);
        seen.add(j);
        break;
      }
    }
  }

  // remove canceled transfers
  tx.transfers = tx.transfers.filter((_, idx) => !seen.has(idx));
}

function annotateRouterSwapRewards(tx: PortfolioMovement) {
  // only look at router buy/sell extrinsics
  if (
    !(
      tx.callModule === "router" &&
      (tx.callModuleFunction === "sell" || tx.callModuleFunction === "buy")
    )
  ) {
    return;
  }

  for (const t of tx.transfers) {
    if (
      !t.label &&
      (t.symbol === "HDX" || t.symbol === "BSX") &&
      t.amount > 0 &&
      t.fromAddressName?.startsWith("modlpy/")
    ) {
      t.label = "Reward";
      t.semanticGroupId = tx.hash + "-reward";
      t.semanticEventIndex = null; // no direct event, it's a side-effect
    }
  }
}

function annotateSwapWithFees(tx: PortfolioMovement): void {
  // only look at router buy/sell extrinsics
  if (
    !(
      tx.callModule === "router" &&
      (tx.callModuleFunction === "sell" || tx.callModuleFunction === "buy")
    )
  ) {
    return;
  }

  // Detect swap events
  const swapEvent = tx.events.find(
    (e: any) =>
      (e.moduleId === "xyk" &&
        ["SellExecuted", "BuyExecuted"].includes(e.eventId)) ||
      (e.moduleId === "router" && e.eventId === "Executed"),
  );

  if (!swapEvent || tx.transfers.length < 3) {
    // no swap → do nothing, just two tokens -> don't to anything neither
    return;
  }

  // Identify largest absolute amount to help detect fee vs. main trade
  const maxAmount = Math.max(
    0,
    ...tx.transfers.map((t: any) => Math.abs(t.amount)),
  );

  for (const t of tx.transfers) {
    // DEX fee detection: small relative transfer to treasury/module
    if (
      t.toAddressName &&
      (t.toAddressName.startsWith("modlpy/") ||
        t.toAddressName.startsWith("modl")) &&
      maxAmount > 0 &&
      Math.abs(t.amount) < 0.01 * maxAmount &&
      !t.label
    ) {
      t.label = "DEX fee";
      t.semanticEventIndex = swapEvent.eventIndex;
      t.semanticGroupId = tx.hash + "-fee";
    }
  }
}

function applyGovernanceVoteFeeRefund(tx: PortfolioMovement) {
  // Must be a council vote
  const isVote = tx.events.some(
    (e: any) => e.moduleId === "council" && e.eventId === "Voted",
  );
  if (!isVote) return false;

  if (!tx.feeTokenSymbol || typeof tx.feeUsed !== "number") return false;

  // Find a positive transfer in the fee token, from the user back to the user
  const refund = (tx.transfers || []).find(
    (t: any) =>
      t.symbol === tx.feeTokenSymbol &&
      t.amount > 0 &&
      // tolerate small float diff vs feeUsed
      Math.abs(t.amount - tx.feeUsed) < 1e-3,
  );

  if (!refund) return false;

  // Remove the refund transfer
  tx.transfers = tx.transfers.filter((t: any) => t !== refund);

  // Adjust feeUsed and drop fiat
  tx.feeUsed = Math.max(0, tx.feeUsed - refund.amount);
  delete tx.feeUsedFiat;
}
