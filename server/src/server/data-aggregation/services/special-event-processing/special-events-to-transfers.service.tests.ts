import { SpecialEventsToTransfersService } from "./special-events-to-transfers.service";
import { SubscanService } from "../../../blockchain/substrate/api/subscan.service";
import { TokenFromMultiLocationService } from "./token-from-multi-location.service";
import { fetchTokens } from "./fetch-tokens";
import { toTransfer } from "./to-transfer";
import { eventConfigs } from "./event-configs";
import { isMultiLocation } from "../../../blockchain/substrate/util/identify-token-from-multi-location";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("./fetch-tokens");
jest.mock("./to-transfer");
jest.mock(
  "../../../blockchain/substrate/util/identify-token-from-multi-location",
  () => ({
    isMultiLocation: jest.fn(() => true),
  }),
);
jest.mock("../../../logger/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

describe("SpecialEventsToTransfersService", () => {
  let subscanService: jest.Mocked<SubscanService>;
  let tokenFromMultiLocationService: jest.Mocked<TokenFromMultiLocationService>;
  let service: SpecialEventsToTransfersService;

  const chainInfo = { token: "DOT", domain: "Polkadot" };

  beforeEach(() => {
    subscanService = {
      fetchEventDetails: jest.fn(),
    } as any;

    tokenFromMultiLocationService = {
      extractTokenInfoFromMultiLocation: jest.fn(),
    } as any;

    service = new SpecialEventsToTransfersService(
      subscanService,
      tokenFromMultiLocationService,
    );

    (fetchTokens as jest.Mock<any>).mockResolvedValue({ extra: "info" });
    (toTransfer as jest.Mock).mockImplementation(
      (event: any, from, to, amount, token) => ({
        extrinsic_index: event.extrinsic_index,
        from,
        to,
        amount,
        token,
      }),
    );

    // replace global eventConfigs with test-only config
    (eventConfigs as any).length = 0;
    (eventConfigs as any).push({
      chains: ["Polkadot"],
      event: "BalancesTransfer",
      handler: jest.fn<any>().mockResolvedValue([
        {
          event: { extrinsic_index: "0xabc", original_event_index: "1" },
          from: "Alice",
          to: "Bob",
          rawAmount: "10000000000",
          token: { symbol: "DOT", decimals: 10, unique_id: "dot" },
          xcm: null,
          label: "xcm-test",
        },
      ]),
    });
  });

  describe("convertToTransfer", () => {
    it("extracts token info if missing symbol and tokenMultiLocation is provided", async () => {
      (isMultiLocation as jest.Mock).mockReturnValue(true);
      tokenFromMultiLocationService.extractTokenInfoFromMultiLocation.mockResolvedValue(
        {
          symbol: "DOT",
          decimals: 10,
          unique_id: "dot",
        },
      );

      const assetMovement = {
        event: { original_event_index: "1" },
        from: "Alice",
        to: "Bob",
        rawAmount: "10000000000",
        token: { unique_id: "preexisting" },
        tokenMultiLocation: { parents: 0, interior: {} },
        xcm: null,
        label: "test",
      };

      const result = await service.convertToTransfer(
        chainInfo,
        assetMovement as any,
      );

      expect(
        tokenFromMultiLocationService.extractTokenInfoFromMultiLocation,
      ).toHaveBeenCalled();
      expect(toTransfer).toHaveBeenCalledWith(
        assetMovement.event,
        "Alice",
        "Bob",
        1, // 10^10 => 1
        expect.objectContaining({ symbol: "DOT" }),
        null,
        "test",
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("handleEvents", () => {
    it("returns transfers when matching config exists", async () => {
      const events = [
        {
          extrinsic_index: "0xabc",
          event_index: "1",
          module_id: "Balances",
          event_id: "Transfer",
          timestamp: 123,
        },
      ];

      const eventDetails = [
        {
          extrinsic_index: "0xabc",
          original_event_index: "1",
          module_id: "Balances",
          event_id: "Transfer",
        },
      ];

      subscanService.fetchEventDetails.mockResolvedValue(eventDetails as any);

      const transfers = await service.handleEvents(
        chainInfo,
        events as any,
        [],
      );

      expect(subscanService.fetchEventDetails).toHaveBeenCalledWith(
        "Polkadot",
        expect.any(Array),
      );
      expect(fetchTokens).toHaveBeenCalled();
      expect(transfers).toHaveLength(1);
      expect(transfers[0].from).toBe("Alice");
      expect(transfers[0].to).toBe("Bob");
    });

    it("logs error but does not throw if handler fails and throwOnError=false", async () => {
      (eventConfigs[0].handler as jest.Mock<any>).mockRejectedValue(
        new Error("boom"),
      );
      subscanService.fetchEventDetails.mockResolvedValue([
        {
          extrinsic_index: "0xabc",
          original_event_index: "1",
          module_id: "Balances",
          event_id: "Transfer",
        } as any,
      ]);

      const events = [
        {
          extrinsic_index: "0xabc",
          event_index: "1",
          module_id: "Balances",
          event_id: "Transfer",
          timestamp: 123,
        },
      ];

      const result = await service.handleEvents(
        chainInfo,
        events as any,
        [],
        false,
      );

      expect(result).toEqual([]); // swallow error
    });

    it("throws if handler fails and throwOnError=true", async () => {
      (eventConfigs[0].handler as jest.Mock<any>).mockRejectedValue(
        new Error("boom"),
      );
      subscanService.fetchEventDetails.mockResolvedValue([
        {
          extrinsic_index: "0xabc",
          original_event_index: "1",
          module_id: "Balances",
          event_id: "Transfer",
        } as any,
      ]);

      const events = [
        {
          extrinsic_index: "0xabc",
          event_index: "1",
          module_id: "Balances",
          event_id: "Transfer",
          timestamp: 123,
        },
      ];

      await expect(
        service.handleEvents(chainInfo, events as any, [], true),
      ).rejects.toThrow("boom");
    });
  });
});
