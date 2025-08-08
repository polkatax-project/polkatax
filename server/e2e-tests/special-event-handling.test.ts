import { describe, test, expect } from "@jest/globals";
import dotenv from "dotenv";
import { envFile } from "../src/server/env.config";
dotenv.config({ path: envFile });
import { SpecialEventsToTransfersService } from "../src/server/data-aggregation/services/special-event-processing/special-events-to-transfers.service";
import { SubscanService } from "../src/server/blockchain/substrate/api/subscan.service";
import { SubscanApi } from "../src/server/blockchain/substrate/api/subscan.api";
import { verifyEventTransfersAreValid } from "./util/verify-transfer-valid";

describe("Special event handling", () => {
  let subscanApi: SubscanApi = new SubscanApi();
  let subscanService: SubscanService = new SubscanService(subscanApi);
  let specialEventsToTransfersService: SpecialEventsToTransfersService =
    new SpecialEventsToTransfersService(subscanService);

  test("verify assetconversion SwapExecuted data extraction", async () => {
    const eventsOfInterest = await subscanApi.searchEvents(
      "assethub-polkadot",
      undefined,
      "assetconversion",
      "SwapExecuted",
      0,
      0,
    );
    const transfers = await specialEventsToTransfersService.handleEvents(
      { token: "DOT", domain: "assethub-polkadot" },
      eventsOfInterest.list,
      [],
      true,
    );
    expect(transfers.length).toBe(200);
    verifyEventTransfersAreValid(transfers);
  }, 120_000);

  test("verify foreignassets Issued data extraction", async () => {
    const eventsOfInterest = await subscanApi.searchEvents(
      "assethub-polkadot",
      undefined,
      "foreignassets",
      "Issued",
      0,
      0,
    );
    const transfers = await specialEventsToTransfersService.handleEvents(
      { token: "DOT", domain: "assethub-polkadot" },
      eventsOfInterest.list,
      [],
      true,
    );
    expect(transfers.length).toBe(100);
    verifyEventTransfersAreValid(transfers);
  }, 120_000);

  test("verify assets Issued data extraction", async () => {
    const eventsOfInterest = await subscanApi.searchEvents(
      "assethub-polkadot",
      undefined,
      "assets",
      "Issued",
      0,
      0,
    );
    const transfers = await specialEventsToTransfersService.handleEvents(
      { token: "DOT", domain: "assethub-polkadot" },
      eventsOfInterest.list,
      [],
      true,
    );
    expect(transfers.length).toBe(100);
    verifyEventTransfersAreValid(transfers);
  }, 120_000);

  test("verify bifrost vtokenminting Minted data extraction", async () => {
    const eventsOfInterest = await subscanApi.searchEvents(
      "bifrost",
      undefined,
      "vtokenminting",
      "Minted",
      0,
      0,
    );
    const transfers = await specialEventsToTransfersService.handleEvents(
      { token: "BNC", domain: "bifrost" },
      eventsOfInterest.list,
      [],
      true,
    );
    expect(transfers.length).toBe(100);
    verifyEventTransfersAreValid(transfers);
  }, 120_000);

  test("verify bifrost vtokenminting RebondedByUnlockId data extraction", async () => {
    const eventsOfInterest = await subscanApi.searchEvents(
      "bifrost",
      undefined,
      "vtokenminting",
      "RebondedByUnlockId",
      0,
      0,
    );
    const transfers = await specialEventsToTransfersService.handleEvents(
      { token: "BNC", domain: "bifrost" },
      eventsOfInterest.list,
      [],
      true,
    );
    expect(transfers.length).toBe(100);
    verifyEventTransfersAreValid(transfers);
  }, 120_000);

  test("verify bifrost vtokenminting Redeemed data extraction", async () => {
    const eventsOfInterest = await subscanApi.searchEvents(
      "bifrost",
      undefined,
      "vtokenminting",
      "Redeemed",
      0,
      0,
    );
    const transfers = await specialEventsToTransfersService.handleEvents(
      { token: "BNC", domain: "bifrost" },
      eventsOfInterest.list,
      [],
      true,
    );
    expect(transfers.length).toBe(100);
    verifyEventTransfersAreValid(transfers);
  }, 120_000);

  test("verify hydration tokens Deposited data extraction", async () => {
    const eventsOfInterest = await subscanApi.searchEvents(
      "hydration",
      undefined,
      "tokens",
      "Deposited",
      0,
      0,
    );
    const transfers = await specialEventsToTransfersService.handleEvents(
      { token: "HDX", domain: "hydration" },
      eventsOfInterest.list,
      [],
      true,
    );
    expect(transfers.length).toBe(100);
    verifyEventTransfersAreValid(transfers);
  }, 120_000);

  test("verify hydration stableswap LiquidityRemoved data extraction", async () => {
    const eventsOfInterest = await subscanApi.searchEvents(
      "hydration",
      undefined,
      "stableswap",
      "LiquidityRemoved",
      0,
      0,
    );
    const transfers = await specialEventsToTransfersService.handleEvents(
      { token: "HDX", domain: "hydration" },
      eventsOfInterest.list,
      [],
      true,
    );
    expect(transfers.length).toBe(100);
    verifyEventTransfersAreValid(transfers);
  }, 120_000);

  test("verify hydration balances Locked data extraction", async () => {
    const eventsOfInterest = await subscanApi.searchEvents(
      "hydration",
      undefined,
      "balances",
      "Locked",
      0,
      0,
    );
    const transfers = await specialEventsToTransfersService.handleEvents(
      { token: "HDX", domain: "hydration" },
      eventsOfInterest.list,
      [],
      true,
    );
    expect(transfers.length).toBe(100);
    verifyEventTransfersAreValid(transfers);
  }, 120_000);

  test("verify hydration balances Unlocked data extraction", async () => {
    const eventsOfInterest = await subscanApi.searchEvents(
      "hydration",
      undefined,
      "balances",
      "Unlocked",
      0,
      0,
    );
    const transfers = await specialEventsToTransfersService.handleEvents(
      { token: "HDX", domain: "hydration" },
      eventsOfInterest.list,
      [],
      true,
    );
    expect(transfers.length).toBe(100);
    verifyEventTransfersAreValid(transfers);
  }, 120_000);

  test("verify coretime broker Purchased data extraction", async () => {
    const eventsOfInterest = await subscanApi.searchEvents(
      "coretime-polkadot",
      undefined,
      "broker",
      "Purchased",
      0,
      0,
    );
    const transfers = await specialEventsToTransfersService.handleEvents(
      { token: "DOT", domain: "coretime-polkadot" },
      eventsOfInterest.list,
      [],
      true,
    );
    expect(transfers.length).toBeGreaterThan(0);
    verifyEventTransfersAreValid(transfers);
  }, 120_000);

  test("verify coretime broker Renewed data extraction", async () => {
    const eventsOfInterest = await subscanApi.searchEvents(
      "coretime-polkadot",
      undefined,
      "broker",
      "Renewed",
      0,
      0,
    );
    const transfers = await specialEventsToTransfersService.handleEvents(
      { token: "DOT", domain: "coretime-polkadot" },
      eventsOfInterest.list,
      [],
      true,
    );
    expect(transfers.length).toBe(100);
    verifyEventTransfersAreValid(transfers);
  }, 120_000);

  test("verify acala earning Bonded data extraction", async () => {
    const eventsOfInterest = await subscanApi.searchEvents(
      "acala",
      undefined,
      "earning",
      "Bonded",
      0,
      0,
    );
    const transfers = await specialEventsToTransfersService.handleEvents(
      { token: "ACA", domain: "acala" },
      eventsOfInterest.list,
      [],
      true,
    );
    expect(transfers.length).toBe(100);
    verifyEventTransfersAreValid(transfers);
  }, 120_000);
});
