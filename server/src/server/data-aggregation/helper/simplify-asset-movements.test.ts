import { describe, expect, it } from "@jest/globals";
import {
  PortfolioMovement,
  TaxableEventTransfer,
} from "../model/portfolio-movement";
import { simplifyAssetMovementsSemanticId } from "./simplify-asset-movements";

describe("simplifyAssetMovementsSemanticId", () => {
  const baseMovement: PortfolioMovement = {
    transfers: [],
    events: [],
    feeUsed: 10,
    feeUsedFiat: 1,
    feeTokenSymbol: "DOT",
    feeTokenUniqueId: "dot",
    xcmFee: 5,
    xcmFeeFiat: 0.5,
    xcmFeeTokenSymbol: "XCM",
    xcmFeeTokenUniqueId: "xcm",
    timestamp: 0,
    extrinsic_index: "123-5",
  } as any;

  const mkTransfer = (
    overrides: Partial<TaxableEventTransfer>,
  ): TaxableEventTransfer => ({
    semanticGroupId: "sg1",
    symbol: "asset1",
    asset_unique_id: "asset1",
    amount: 1,
    price: 2,
    from: "alice",
    to: "bob",
    label: "Treasury grant",
    module: "balances",
    semanticEventIndex: "0",
    ...overrides,
  });

  it("keeps simple single transfer unchanged", () => {
    const movement: PortfolioMovement = {
      ...baseMovement,
      transfers: [mkTransfer({})],
    };

    const result = simplifyAssetMovementsSemanticId("bob", [movement]);

    expect(result).toHaveLength(1);
    expect(result[0].transfers[0].fiatValue).toBe(2); // 1 * 2
  });

  it("merges transfers in same semantic group", () => {
    const movement: PortfolioMovement = {
      ...baseMovement,
      transfers: [
        mkTransfer({ amount: 2, price: 3 }),
        mkTransfer({ amount: 3, price: 3 }),
      ],
    };

    const result = simplifyAssetMovementsSemanticId("bob", [movement]);

    expect(result).toHaveLength(1);
    expect(result[0].transfers).toHaveLength(1);
    expect(result[0].transfers[0].amount).toBe(5);
    expect(result[0].transfers[0].fiatValue).toBe(15); // 5 * 3
  });

  it("splits transfers into multiple portfolio movements", () => {
    const movement: PortfolioMovement = {
      ...baseMovement,
      transfers: [
        mkTransfer({ semanticGroupId: "sg1", asset_unique_id: "a1" }),
        mkTransfer({ semanticGroupId: "sg2", asset_unique_id: "a2" }),
      ],
    };

    const result = simplifyAssetMovementsSemanticId("bob", [movement]);

    expect(result).toHaveLength(2);
    expect(result.every((m) => m.transfers.length === 1)).toBe(true);
    // First movement should retain fee info
    expect(result[0].feeUsed).toBe(10);
    expect(result[1].feeUsed).toBe(0);
  });

  it("keeps XCM fee fields only when XCM transfers exist", () => {
    const movement: PortfolioMovement = {
      ...baseMovement,
      transfers: [
        mkTransfer({ label: "XCM transfer", semanticGroupId: "sg1" }),
        mkTransfer({ semanticGroupId: "sg2" }),
      ],
    };

    const result = simplifyAssetMovementsSemanticId("bob", [movement]);

    const xcmMovement = result.find((m) =>
      m.transfers.some((t) => t.label === "XCM transfer"),
    );
    const normalMovement = result.find((m) =>
      m.transfers.every((t) => t.label !== "XCM transfer"),
    );

    expect(xcmMovement?.xcmFee).toBe(5);
    expect(normalMovement?.xcmFee).toBe(0);
  });

  it("is idempotent when called twice", () => {
    const movement: PortfolioMovement = {
      ...baseMovement,
      transfers: [
        mkTransfer({ semanticGroupId: "sg1", asset_unique_id: "a1" }),
        mkTransfer({ semanticGroupId: "sg2", asset_unique_id: "a2" }),
      ],
    };

    const once = simplifyAssetMovementsSemanticId("bob", [movement]);
    const twice = simplifyAssetMovementsSemanticId("bob", once);

    expect(twice).toEqual(once);
  });
});
