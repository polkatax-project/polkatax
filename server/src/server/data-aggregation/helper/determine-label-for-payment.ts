import { PortfolioMovement } from "../model/portfolio-movement";

export type PaymentLabel =
  | "transfer"
  | "treasury_payout"
  | "crowdloan_contribution"
  | "xcm_transfer"
  | "staking";

const classificationMap: Record<
  string,
  {
    events: { moduleId: string; eventId: string; label: PaymentLabel }[];
    modules: {
      name: string;
      label?: PaymentLabel;
      functions: { name: string; label: PaymentLabel }[];
    }[];
    functions: { name: string; label: PaymentLabel }[];
  }
> = {
  default: {
    modules: [
      {
        name: "balances",
        functions: [],
        label: "transfer",
      },
      {
        name: "treasury",
        functions: [],
        label: "treasury_payout",
      },
      {
        name: "childbounties",
        functions: [
          {
            name: "claim_child_bounty",
            label: "treasury_payout",
          },
        ],
      },
      {
        name: "crowdloan",
        functions: [
          {
            name: "contribute",
            label: "crowdloan_contribution",
          },
        ],
      },
      {
        name: "xcmpallet",
        functions: [
          {
            name: "reserve_transfer_assets",
            label: "xcm_transfer",
          },
          {
            name: "transfer_assets_using_type_and_then",
            label: "xcm_transfer",
          },
          {
            name: "limited_reserve_transfer_assets",
            label: "xcm_transfer",
          },
          {
            name: "limited_teleport_assets",
            label: "xcm_transfer",
          },
        ],
        label: "xcm_transfer",
      },
    ],
    functions: [],
    events: [
      {
        moduleId: "childbounties",
        eventId: "Awarded",
        label: "treasury_payout",
      },
    ],
  },
};

export const determineLabelForPayment = (
  chain: string,
  transfer: PortfolioMovement,
): PaymentLabel | undefined => {
  const classifcations =
    classificationMap[chain] ?? classificationMap["default"];
  if (transfer.provenance == "stakingRewards") {
    return "staking";
  }
  if (transfer.provenance == "xcm") {
    return "xcm_transfer";
  }
  const rootFunctionInfo = classifcations.functions.find(
    (f) => f.name === transfer.callModuleFunction,
  );
  if (rootFunctionInfo) {
    return rootFunctionInfo.label;
  }
  const moduleInfo = classifcations.modules.find(
    (m) => m.name === transfer.callModule,
  );
  const functionInfo = moduleInfo?.functions.find(
    (f) => f.name === transfer.callModuleFunction,
  );
  if (functionInfo) {
    return functionInfo.label;
  }
  if (transfer.events && transfer.events.length > 0) {
    const match = classifcations.events.find((e) =>
      transfer.events.find(
        (ev) => ev.eventId === e.eventId && ev.moduleId == e.moduleId,
      ),
    );
    if (match) {
      return match.label;
    }
  }
  return "transfer";
};
