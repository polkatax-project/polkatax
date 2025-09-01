import {
  EventDetails,
  SubscanEvent,
} from "../../../blockchain/substrate/model/subscan-event";
import { XcmTransfer } from "../../../blockchain/substrate/model/xcm-transfer";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { onAssethubAssetsIssued } from "./on-assethub-asset-issued";
import { onAssethubForeignAssetsIssued } from "./on-assethub-foreign-asset-issued";
import { onBalancesDeposit } from "./on-balances-deposit";
import { onBalancesWithdraw } from "./on-balances-withdraw";
import { onCoretimePurchased } from "./on-coretime-purchased";
import { onHydrationLiquidityRemoved } from "./on-hydration-liquidity-removed";
import { onHydrationStableSwapLiquidityAdded } from "./on-hydration-stable-swap-liquidity-added";
import { onMigratedDelegation } from "./on-migrated-delegation";
import { onPhalaAssetBurned } from "./on-phala-asset-burned";
import { onReserveRepatriated } from "./on-reserve-repatriated";
import {
  onZenlinkProtcolAssetSwap,
  onZenlinkProtcolLiquidityAdded,
  onZenlinkProtcolLiquidityRemoved,
} from "./on-zenlink-protocol-assetswap";

export const eventConfigs: {
  chains;
  event: string | string[];
  condition?: (
    event: SubscanEvent,
    peerEvents: SubscanEvent[],
    xcmList: XcmTransfer[],
  ) => boolean;
  handler: (
    e: EventDetails,
    context: EventHandlerContext,
  ) => Promise<EventDerivedAssetMovement | EventDerivedAssetMovement[]>;
}[] = [
  {
    chains: ["coretime-polkadot", "coretime-kusama"],
    event: "brokerPurchased",
    handler: (e, context) => onCoretimePurchased(e, context),
  },
  {
    chains: ["coretime-polkadot", "coretime-kusama"],
    event: "brokerRenewed",
    handler: (e, context) => onCoretimePurchased(e, context),
  },
  {
    chains: ["*"],
    event: "balancesReserveRepatriated",
    handler: (e, context) => onReserveRepatriated(e, context),
  },
  {
    chains: ["energywebx"],
    event: "balancesDeposit",
    handler: (e, context) =>
      onBalancesDeposit(e, { ...context, label: "XCM transfer" }),
    condition: (event, events) =>
      !!events.find(
        (e) => e.module_id + e.event_id === "tokenmanagerAVTLifted",
      ),
  },
  {
    chains: ["energywebx"],
    event: "balancesWithdraw",
    handler: (e, context) =>
      onBalancesWithdraw(e, { ...context, label: "XCM transfer" }),
    condition: (event, events) =>
      !!events.find(
        (e) => e.module_id + e.event_id === "tokenmanagerAvtLowered",
      ),
  },
  {
    chains: ["acala"],
    event: "earningBonded",
    handler: (e, context) =>
      onBalancesDeposit(e, { ...context, label: "Reward" }),
  },
  {
    chains: ["hydration", "basilisk"],
    event: "stableswapLiquidityRemoved",
    handler: (e, context) => onHydrationLiquidityRemoved(e, context),
  },
  {
    chains: ["polkadot", "kusama"],
    event: "balancesBurned",
    handler: (e, context) => onBalancesWithdraw(e, context),
    condition: (event, events) =>
      !!events.find(
        (e) => e.module_id + e.event_id === "identitymigratorIdentityReaped",
      ),
  },
  {
    chains: ["hydration", "bifrsot"],
    event: "stableswapLiquidityAdded",
    handler: (e, context) => onHydrationStableSwapLiquidityAdded(e, context),
  },
  {
    chains: ["assethub-polkadot", "assethub-kusama"],
    event: "foreignassetsIssued",
    handler: (e, context) => onAssethubForeignAssetsIssued(e, context),
  },
  {
    chains: [
      "assethub-polkadot",
      "assethub-kusama",
      "coretime-polkadot",
      "coretime-kusama",
    ],
    event: "assetsIssued",
    handler: (e, context) => onAssethubAssetsIssued(e, context),
  },
  {
    chains: ["*"],
    event: "balancesDeposit",
    handler: (e, context) => onBalancesDeposit(e, context),
    condition: (event, events, xcmList) =>
      !!events.find((e) => e.module_id + e.event_id === "systemNewAccount") &&
      !xcmList.find((xcm) => xcm.extrinsic_index === event.extrinsic_index),
  },
  {
    chains: ["*"],
    event: "balancesWithdraw",
    handler: (e, context) => onBalancesWithdraw(e, context),
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
    handler: (e, context) => onBalancesDeposit(e, context),
  },
  {
    chains: ["polkadot", "kusama"],
    event: "delegatedstakingMigratedDelegation",
    handler: (e, context) => onMigratedDelegation(e, context),
  },
  {
    chains: ["manta"],
    event: "zenlinkprotocolLiquidityRemoved",
    handler: (e, context) => onZenlinkProtcolLiquidityRemoved(e, context),
  },
  {
    chains: ["manta"],
    event: "zenlinkprotocolAssetSwap",
    handler: (e, context) => onZenlinkProtcolAssetSwap(e, context),
  },
  {
    chains: ["manta"],
    event: "zenlinkprotocolLiquidityAdded",
    handler: (e, context) => onZenlinkProtcolLiquidityAdded(e, context),
  },
  {
    chains: ["phala"],
    event: "assetsBurned",
    handler: (e, context) => onPhalaAssetBurned(e, context),
  },
];
