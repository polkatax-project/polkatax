import { describe, expect, it } from "@jest/globals";
import { PortfolioMovement } from "../model/portfolio-movement";
import { determineLabelForPayment } from "./determine-label-for-payment";

describe("determineLabelForPayment", () => {
  const baseMovement: PortfolioMovement = {
    transfers: [],
    events: [],
    feeUsed: 0,
    feeUsedFiat: 0,
    timestamp: 0,
    extrinsic_index: 'abc-2'
  };

  it("returns label if portfolioMovement already has one", () => {
    const movement: PortfolioMovement = { ...baseMovement, label: "Reward" };
    expect(determineLabelForPayment("bifrost", movement)).toBe("Reward");
  });

  it("returns transfer label when all transfers share the same label", () => {
    const movement: PortfolioMovement = {
      ...baseMovement,
      transfers: [
        { amount: 1, label: "Liquidity added" },
        { amount: 2, label: "Liquidity added" },
      ] as any,
    };
    expect(determineLabelForPayment("hydration", movement)).toBe(
      "Liquidity added",
    );
  });

  it("returns event classification label when event matches", () => {
    const movement: PortfolioMovement = {
      ...baseMovement,
      events: [{ moduleId: "farming", eventId: "claimed", eventIndex: 0 }],
    } as any;
    expect(determineLabelForPayment("bifrost", movement)).toBe("Reward");
  });

  it("returns call module function classification label", () => {
    const movement: PortfolioMovement = {
      ...baseMovement,
      callModule: "farming",
      callModuleFunction: "deposit",
    } as any;
    expect(determineLabelForPayment("bifrost", movement)).toBe(
      "Farming deposit",
    );
  });

  it("returns module-level label when function not matched but module has label", () => {
    const movement: PortfolioMovement = {
      ...baseMovement,
      callModule: "treasury",
      callModuleFunction: "nonexistent",
    } as any;
    expect(determineLabelForPayment("kusama", movement)).toBe("Treasury grant");
  });

  it("returns Swap when exactly one positive and one negative transfer", () => {
    const movement: PortfolioMovement = {
      ...baseMovement,
      transfers: [
        { amount: 10, label: undefined },
        { amount: -5, label: undefined },
      ] as any,
    };
    expect(determineLabelForPayment("hydration", movement)).toBe("Swap");
  });

  it("returns undefined if no rule matches", () => {
    const movement: PortfolioMovement = {
      ...baseMovement,
      transfers: [{ amount: 5, label: undefined }] as any,
      events: [],
      callModule: "unknown",
      callModuleFunction: "unknown",
    } as any;
    expect(determineLabelForPayment("randomchain", movement)).toBeUndefined();
  });
});
