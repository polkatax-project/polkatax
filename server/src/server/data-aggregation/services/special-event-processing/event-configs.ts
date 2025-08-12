import {
  EventDetails,
  SubscanEvent,
} from "../../../blockchain/substrate/model/subscan-event";
import { XcmTransfer } from "../../../blockchain/substrate/model/xcm-transfer";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";
import { Label } from "../../model/portfolio-movement";
import { AssetInfos } from "./asset-infos";
import { onAssethubAssetsIssued } from "./on-assethub-asset-issued";
import { onAssethubForeignAssetsIssued } from "./on-assethub-foreign-asset-issued";
import { onAssethubSwapExecuted } from "./on-assethub-swap-executed";
import { onBalancesDeposit } from "./on-balances-deposit";
import { onBalancesWithdraw } from "./on-balances-withdraw";
import { onBifrostMintedVToken } from "./on-bifrost-minted-vtoken";
import { onBifrostRedeemedVToken } from "./on-bifrost-redeemed-vtoken";
import { onCoretimePurchased } from "./on-coretime-purchased";
import { onHydrationLiquidityRemoved } from "./on-hydration-liquidity-removed";
import { onMigratedDelegation } from "./on-migrated-delegation";
import { onReserveRepatriated } from "./on-reserve-repatriated";

/**
 * TODO: https://manta.subscan.io/event?extrinsic=2191862-4 zenlinkprotocol (AssetSwap)
 *
 */

export const eventConfigs: {
  chains;
  event: string | string[];
  condition?: (
    event: SubscanEvent,
    peerEvents: SubscanEvent[],
    xcmList: XcmTransfer[],
  ) => boolean;
  handler: (
    chain: { domain: string; token: string },
    e: EventDetails,
    context: AssetInfos & { events: SubscanEvent[] } & {
      xcmList: XcmTransfer[];
      label?: Label;
    },
  ) => Promise<EventDerivedTransfer | EventDerivedTransfer[]>;
}[] = [
  {
    chains: ["coretime-polkadot", "coretime-kusama"],
    event: "brokerPurchased",
    handler: (c, e, context) => onCoretimePurchased(e, context),
  },
  {
    chains: ["coretime-polkadot", "coretime-kusama"],
    event: "brokerRenewed",
    handler: (c, e, context) => onCoretimePurchased(e, context),
  },
  {
    chains: ["*"],
    event: "balancesReserveRepatriated",
    handler: (c, e, context) => onReserveRepatriated(e, context),
  },
  {
    chains: ["energywebx"],
    event: "balancesDeposit",
    handler: (c, e, context) =>
      onBalancesDeposit(e, { ...context, label: "XCM transfer" }),
    condition: (event, events) =>
      !!events.find(
        (e) => e.module_id + e.event_id === "tokenmanagerAVTLifted",
      ),
  },
  {
    chains: ["energywebx"],
    event: "balancesWithdraw",
    handler: (c, e, context) =>
      onBalancesWithdraw(e, { ...context, label: "XCM transfer" }),
    condition: (event, events) =>
      !!events.find(
        (e) => e.module_id + e.event_id === "tokenmanagerAvtLowered",
      ),
  },
  {
    chains: ["acala"],
    event: "earningBonded",
    handler: (c, e, context) =>
      onBalancesDeposit(e, { ...context, label: "Reward" }),
  },
  {
    chains: ["hydration", "basilisk"],
    event: "stableswapLiquidityRemoved",
    handler: (c, e, context) => onHydrationLiquidityRemoved(e, context),
  },
  {
    chains: ["hydration", "basilisk"],
    event: "balancesLocked",
    handler: (c, e, context) => onBalancesDeposit(e, context),
  },
  {
    chains: ["hydration", "basilisk"],
    event: "balancesUnlocked",
    handler: (c, e, context) => onBalancesWithdraw(e, context),
  },
  {
    chains: ["polkadot", "kusama"],
    event: "balancesBurned",
    handler: (c, e, context) => onBalancesWithdraw(e, context),
    condition: (event, events) =>
      !!events.find(
        (e) => e.module_id + e.event_id === "identitymigratorIdentityReaped",
      ),
  },
  /*{
    chains: ["bifrost", "bifrost-kusama"],
    event: "balancesIssued",
    handler: (c, e, context) => onBalancesDeposit(e, context),
  },*/
  {
    chains: ["bifrost", "bifrost-kusama"],
    event: "vtokenmintingRedeemed",
    handler: (c, e, context) => onBifrostRedeemedVToken(e, context),
  },
  {
    chains: ["bifrost", "bifrost-kusama"],
    event: "vtokenmintingMinted",
    handler: (c, e, context) => onBifrostMintedVToken(e, context),
  },
  {
    chains: ["bifrost", "bifrost-kusama"],
    event: "vtokenmintingRebondedByUnlockId",
    handler: (c, e, context) => onBifrostMintedVToken(e, context),
  },
  {
    chains: ["assethub-polkadot", "assethub-kusama"],
    event: "assetconversionSwapExecuted",
    handler: (c, e, context) => onAssethubSwapExecuted(e, context),
  },
  {
    chains: ["assethub-polkadot", "assethub-kusama"],
    event: "foreignassetsIssued",
    handler: (c, e, context) => onAssethubForeignAssetsIssued(e, context),
  },
  /*{
    chains: ["hydration", "basilisk"],
    event: "tokensDeposited",
    handler: (c, e, context) => onHydrationCurrenciesDeposited(e, context),
  },*/
  {
    chains: [
      "assethub-polkadot",
      "assethub-kusama",
      "coretime-polkadot",
      "coretime-kusama",
    ],
    event: "assetsIssued",
    handler: (c, e, context) => onAssethubAssetsIssued(e, context),
  },
  {
    chains: ["*"],
    event: "balancesDeposit",
    handler: (c, e, context) => onBalancesDeposit(e, context),
    condition: (event, events, xcmList) =>
      !!events.find((e) => e.module_id + e.event_id === "systemNewAccount") &&
      !xcmList.find((xcm) => xcm.extrinsic_index === event.extrinsic_index),
  },
  {
    chains: ["*"],
    event: "balancesWithdraw",
    handler: (c, e, context) => onBalancesWithdraw(e, context),
    condition: (event, events, xcmList) =>
      !!events.find(
        (e) =>
          e.module_id + e.event_id === "systemKilledAccount" &&
          !xcmList.find((xcm) => xcm.extrinsic_index === event.extrinsic_index),
      ),
  },
  {
    chains: [
      "assethub-polkadot",
      "assethub-kusama",
      "coretime-polkadot",
      "coretime-kusama",
      "people-polkadot",
      "people-kusama",
      "collectives-polkadot",
      "collectives-kusama",
    ],
    event: "balancesMinted",
    handler: (c, e, context) => onBalancesDeposit(e, context),
  },
  {
    chains: ["astar", "mythos", "spiritnet"],
    event: "balancesThawed",
    handler: (c, e, context) => onBalancesWithdraw(e, context),
  },
  {
    chains: ["astar", "mythos", "spiritnet"],
    event: "balancesFrozen",
    handler: (c, e, context) => onBalancesDeposit(e, context),
  },
  {
    chains: ["polkadot", "kusama"],
    event: "delegatedstakingMigratedDelegation",
    handler: (c, e, context) => onMigratedDelegation(c, e, context),
  },
];
