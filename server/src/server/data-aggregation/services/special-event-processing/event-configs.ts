import {
  EventDetails,
  SubscanEvent,
} from "../../../blockchain/substrate/model/subscan-event";
import { XcmTransfer } from "../../../blockchain/substrate/model/xcm-transfer";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { onAssetRegistryExistentialDepositPaid } from "./on-asset-registry-existential-deposit-paid";
import { onAssethubSwapExecuted } from "./on-assethub-swap-executed";
import { onBalancesDeposit } from "./on-balances-deposit";
import { onBalancesWithdraw } from "./on-balances-withdraw";
import { onCoretimePurchased } from "./on-coretime-purchased";
import { onHydrationLiquidityRemoved } from "./on-hydration-liquidity-removed";
import { onHydrationRouterExecuted } from "./on-hydration-router-executed";
import { onHydrationStableSwapLiquidityAdded } from "./on-hydration-stable-swap-liquidity-added";
import { onHydrationXykRewardClaimed } from "./on-hydration-xyk-reward-claimed";
import { onMigratedDelegation } from "./on-migrated-delegation";
import { onReserveRepatriated } from "./on-reserve-repatriated";
import { onXykLiquidityAdded } from "./on-xyk-liquidity-added";
import {
  onZenlinkProtcolAssetSwap,
  onZenlinkProtcolLiquidityAdded,
  onZenlinkProtcolLiquidityRemoved,
} from "./on-zenlink-protocol-assetswap";

export const eventConfigs: {
  chains;
  event: string | string[];
  condition?: (
    event: SubscanEvent | EventDetails,
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
      onBalancesDeposit(e, {
        ...context,
        label: "XCM transfer",
        semanticGroupId: e.event_index,
      }),
    condition: (event, events) =>
      !!events.find(
        (e) => e.module_id + e.event_id === "tokenmanagerAVTLifted",
      ),
  },
  {
    chains: ["energywebx"],
    event: "balancesWithdraw",
    handler: (e, context) =>
      onBalancesWithdraw(e, {
        ...context,
        label: "XCM transfer",
        semanticGroupId: e.event_index,
      }),
    condition: (event, events) =>
      !!events.find(
        (e) => e.module_id + e.event_id === "tokenmanagerAvtLowered",
      ),
  },
  {
    chains: ["acala"],
    event: "earningBonded",
    handler: (e, context) =>
      onBalancesDeposit(e, {
        ...context,
        label: "Reward",
        semanticGroupId: e.event_index,
      }),
  },
  {
    chains: ["hydration", "basilisk"],
    event: "stableswapLiquidityAdded",
    handler: (e, context) => onHydrationStableSwapLiquidityAdded(e, context),
  },
  {
    chains: ["hydration", "basilisk"],
    event: "routerExecuted",
    handler: (e, context) => onHydrationRouterExecuted(e, context),
  },
  // omnipoolliquiditymining (RewardClaimed)
  // omnipool (LiquidityRemoved)
  {
    chains: ["hydration", "basilisk"],
    event: "stableswapLiquidityRemoved",
    handler: (e, context) => onHydrationLiquidityRemoved(e, context),
  },
  {
    chains: ["hydration", "basilisk"],
    event: "xykliquidityminingRewardClaimed",
    handler: (e, context) => onHydrationXykRewardClaimed(e, context),
  },
  {
    chains: ["assethub-polkadot", "assethub-kusama"],
    event: "assetconversionSwapExecuted",
    handler: (e, context) => onAssethubSwapExecuted(e, context),
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
    chains: ["hydration", "basilisk"],
    event: "xykLiquidityAdded",
    handler: (e, context) => onXykLiquidityAdded(e, context),
  },
  {
    chains: ["hydration", "basilisk"],
    event: "assetregistryExistentialDepositPaid",
    handler: (e, context) => onAssetRegistryExistentialDepositPaid(e, context),
  },
];
