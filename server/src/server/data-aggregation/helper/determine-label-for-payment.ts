import { Label } from "../../../common/model/label";
import { PortfolioMovement } from "../model/portfolio-movement";

type EventClassification = {
  chains: string[];
  events: {
    moduleId: string;
    eventId: string;
    label: Label;
  }[];
};

const eventClassifications: EventClassification[] = [
  {
    chains: ["bifrost", "bifrost-kusama"],
    events: [
      {
        moduleId: "childbounties",
        eventId: "Awarded",
        label: "Treasury grant" as const,
      },
      {
        moduleId: "farming",
        eventId: "Deposited",
        label: "Farming deposit" as const,
      },
      {
        moduleId: "farming",
        eventId: "WithdrawClaimed",
        label: "Farming withdraw" as const,
      },
      {
        moduleId: "farming",
        eventId: "Withdrawn",
        label: "Farming withdraw" as const,
      },
      {
        moduleId: "farming",
        eventId: "claimed",
        label: "Reward" as const,
      },
      {
        moduleId: "stableasset",
        eventId: "RedeemedProportion",
        label: "Liquidity removed" as const,
      },
      {
        moduleId: "stableasset",
        eventId: "YieldCollected",
        label: "Reward" as const,
      },
    ],
  },
  {
    chains: ["hydration", "basilisk"],
    events: [
      {
        moduleId: "omnipoolliquiditymining",
        eventId: "RewardClaimed",
        label: "Reward" as const,
      },
      {
        moduleId: "omnipool",
        eventId: "LiquidityAdded",
        label: "Liquidity added" as const,
      },
      {
        moduleId: "omnipool",
        eventId: "LiquidityRemoved",
        label: "Liquidity removed" as const,
      },
      {
        moduleId: "stableswap",
        eventId: "LiquidityAdded",
        label: "Liquidity added" as const,
      },
      {
        moduleId: "xyk",
        eventId: "LiquidityAdded",
        label: "Liquidity added" as const,
      },
      {
        moduleId: "xyk",
        eventId: "LiquidityRemoved",
        label: "Liquidity removed" as const,
      },
      {
        moduleId: "xykliquiditymining",
        eventId: "SharesDeposited",
        label: "Farming deposit" as const,
      },
      {
        moduleId: "xykliquiditymining",
        eventId: "SharesWithdrawn",
        label: "Farming withdraw" as const,
      },
      {
        moduleId: "xykliquiditymining",
        eventId: "DepositDetroyed",
        label: "Farming withdraw" as const,
      },
      {
        moduleId: "xykliquiditymining",
        eventId: "RewardClaimed",
        label: "Reward" as const,
      },
      {
        moduleId: "staking",
        eventId: "RewardsClaimed",
        label: "Reward" as const,
      },
    ],
  },
  {
    chains: ["mythos"],
    events: [
      {
        moduleId: "collatorstaking",
        eventId: "StakingRewardReceived",
        label: "Staking reward" as const,
      },
    ],
  },
  {
    chains: ["darwinia"],
    events: [
      {
        moduleId: "darwiniastaking",
        eventId: "RewardAllocated",
        label: "Staking reward" as const,
      },
    ],
  },
  {
    chains: ["robonomics-freemium"],
    events: [
      {
        moduleId: "staking",
        eventId: "reward",
        label: "Staking reward" as const,
      },
    ],
  },
  {
    chains: ["*"],
    events: [
      {
        moduleId: "parachainstaking",
        eventId: "Rewarded",
        label: "Staking reward" as const,
      },
    ],
  },
];

type CallFunction = {
  name: string;
  label: Label;
};

type CallModule = {
  module: string;
  functions: CallFunction[];
  label?: Label;
};

type CallModuleClassification = {
  chains: string[];
  callModules: CallModule[];
};

const callModuleClassifications: CallModuleClassification[] = [
  {
    chains: ["bifrost", "bifrost-kusama"],
    callModules: [
      {
        module: "stablepool",
        functions: [
          {
            name: "add_liquidity",
            label: "Liquidity added" as const,
          },
          {
            name: "remove_liquidity",
            label: "Liquidity removed" as const,
          },
          {
            name: "redeem_proportion",
            label: "Liquidity removed" as const,
          },
        ],
      },
      {
        module: "farming",
        functions: [
          {
            name: "deposit",
            label: "Farming deposit" as const,
          },
          {
            name: "withdraw",
            label: "Farming withdraw" as const,
          },
          {
            name: "withdraw_claim",
            label: "Farming withdraw" as const,
          },
          {
            name: "claim",
            label: "Reward" as const,
          },
        ],
      },
      {
        module: "stablepool",
        functions: [
          {
            name: "add_liquidity",
            label: "Liquidity added" as const,
          },
          {
            name: "remove_liquidity",
            label: "Liquidity removed" as const,
          },
        ],
      },
    ],
  },
  {
    chains: ["hydration", "basilisk"],
    callModules: [
      {
        module: "stableswap",
        functions: [
          {
            name: "add_liquidity",
            label: "Liquidity added" as const,
          },
          {
            name: "add_liquidity_one_asset",
            label: "Liquidity added" as const,
          },
          {
            name: "remove_liquidity_one_asset",
            label: "Liquidity removed" as const,
          },
          {
            name: "remove_liquidity",
            label: "Liquidity removed" as const,
          },
        ],
      },
      {
        module: "xykliquiditymining",
        functions: [
          {
            name: "add_liquidity_and_join_farms",
            label: "Liquidity added" as const,
          },
          {
            name: "add_liquidity",
            label: "Liquidity added" as const,
          },
        ],
      },
      {
        module: "omnipoolliquiditymining",
        functions: [
          {
            name: "deposit_shares",
            label: "Farming deposit" as const,
          },
        ],
      },
    ],
  },
  {
    chains: ["*"],
    callModules: [
      {
        module: "treasury",
        functions: [],
        label: "Treasury grant" as const,
      },
      {
        module: "xtokens",
        functions: [
          {
            name: "transfer",
            label: "XCM transfer" as const,
          },
          {
            name: "transfer_multicurrencies",
            label: "XCM transfer" as const,
          },
        ],
      },
      {
        module: "childbounties",
        functions: [
          {
            name: "claim_child_bounty",
            label: "Treasury grant" as const,
          },
        ],
      },
      {
        module: "xcmpallet",
        functions: [
          {
            name: "reserve_transfer_assets",
            label: "XCM transfer" as const,
          },
          {
            name: "transfer_assets_using_type_and_then",
            label: "XCM transfer" as const,
          },
          {
            name: "limited_reserve_transfer_assets",
            label: "XCM transfer" as const,
          },
          {
            name: "limited_teleport_assets",
            label: "XCM transfer" as const,
          },
        ],
        label: "XCM transfer" as const,
      },
      {
        module: "polkadotxcm",
        functions: [
          {
            name: "limited_reserve_transfer_assets",
            label: "XCM transfer" as const,
          },
          {
            name: "reserve_transfer_assets",
            label: "XCM transfer" as const,
          },
        ],
        label: "XCM transfer" as const,
      },
      {
        module: "evm",
        functions: [
          {
            name: "call",
            label: "EVM Transaction" as const,
          },
        ],
      },
      {
        module: "nominationpools",
        functions: [
          {
            name: "claim_payout",
            label: "Staking reward" as const,
          },
          {
            name: "bond_extra",
            label: "Stake" as const,
          },
          {
            name: "withdraw_unbonded",
            label: "Unstake" as const,
          },
        ],
      },
      {
        module: "parachainstaking",
        functions: [
          {
            name: "unlock_unstaked",
            label: "Unstake" as const,
          },
          {
            name: "join_delegators",
            label: "Stake" as const,
          },
          {
            name: "withdraw_unbonded",
            label: "Unstake" as const,
          },
        ],
      },
    ],
  },
  {
    chains: ["polkadot", "kusama"],
    callModules: [
      {
        module: "crowdloan",
        functions: [
          {
            name: "contribute",
            label: "Crowdloan contribution" as const,
          },
        ],
      },
    ],
  },
  {
    chains: ["alephzero"],
    callModules: [
      {
        module: "nominationpools",
        functions: [
          { name: "claim_payout", label: "Staking reward" as const },
          { name: "withdraw_unbonded", label: "Unstake" as const },
          { name: "join", label: "Stake" as const },
          { name: "bond_extra", label: "Stake" as const },
        ],
      },
    ],
  },
  {
    chains: ["astar"],
    callModules: [
      {
        module: "Ethereum",
        functions: [{ name: "Transact", label: "EVM Transaction" as const }],
      },
    ],
  },
];

const getEventClassificationRules = (
  chain: string,
): {
  moduleId: string;
  eventId: string;
  label: Label;
}[] => {
  return eventClassifications
    .filter((e) => e.chains.includes(chain) || e.chains.includes("*"))
    .map((e) => e.events)
    .flat();
};

const getCallModuleClassificationRules = (chain: string): CallModule[] => {
  return callModuleClassifications
    .filter((e) => e.chains.includes(chain) || e.chains.includes("*"))
    .flatMap((e) => e.callModules);
};

export const determineLabelForPayment = (
  chain: string,
  portfolioMovement: PortfolioMovement,
): Label | undefined => {
  if (portfolioMovement.label) {
    return portfolioMovement.label;
  }

  const labelFromTransfers = portfolioMovement.transfers
    .map((t) => t.label)
    .filter((l) => !!l);
  if (labelFromTransfers.length === 1) {
    return labelFromTransfers[0];
  }

  if (portfolioMovement.callModule && portfolioMovement.callModuleFunction) {
    const moduleMatch = getCallModuleClassificationRules(chain).find(
      (c) => c.module === portfolioMovement.callModule,
    );
    if (moduleMatch) {
      const functionMatch = moduleMatch.functions.find(
        (f) => f.name === portfolioMovement.callModuleFunction,
      );
      if (functionMatch) {
        return functionMatch.label;
      } else if (moduleMatch.label) {
        return moduleMatch.label;
      }
    }
  }

  const eventMatch = getEventClassificationRules(chain).find((c) =>
    portfolioMovement.events.some(
      (e) => e.eventId === c.eventId && e.moduleId === c.moduleId,
    ),
  );

  if (
    portfolioMovement.transfers.some((t) => t.amount > 0) &&
    portfolioMovement.transfers.some((t) => t.amount < 0)
  ) {
    return "Swap";
  }

  if (eventMatch) {
    return eventMatch.label;
  }
};
