import { SpecialEventsToTransfersService } from "./special-events-to-transfers.service";
import { SubscanService } from "../../../blockchain/substrate/api/subscan.service";
import { SubscanEvent } from "../../../blockchain/substrate/model/subscan-event";
import { expect, it, jest, describe, beforeEach } from "@jest/globals";

jest.mock("./event-configs", () => {
  return {
    eventConfigs: [
      {
        chains: ["energywebx"],
        event: "balancesDeposit",
        handler: jest
          .fn<any>()
          .mockResolvedValue([{ extrinsic_index: "0x123", amount: 1000 }]),
        condition: (event: SubscanEvent, peerEvents: SubscanEvent[]) =>
          peerEvents.some(
            (e) => e.module_id + e.event_id === "tokenmanagerAVTLifted",
          ),
      },
    ],
  };
});

jest.mock("./fetch-tokens", () => ({
  fetchTokens: jest.fn<any>().mockResolvedValue({
    tokens: [],
    foreignAssets: [],
  }),
}));

describe("SpecialEventsToTransfersService", () => {
  let subscanServiceMock: jest.Mocked<SubscanService>;
  let service: SpecialEventsToTransfersService;

  beforeEach(() => {
    subscanServiceMock = {
      fetchEventDetails: jest.fn(),
    } as any;

    service = new SpecialEventsToTransfersService(subscanServiceMock);
  });

  it("should match and process a balancesDeposit event with matching peer event", async () => {
    const mockEvents: SubscanEvent[] = [
      {
        event_index: "0x1",
        extrinsic_index: "0xabc",
        module_id: "balances",
        event_id: "Deposit",
        timestamp: 123456,
      },
      {
        event_index: "0x2",
        extrinsic_index: "0xabc",
        module_id: "tokenmanager",
        event_id: "AVTLifted",
        timestamp: 123456,
      },
    ] as any;

    const eventDetails = [
      {
        event_index: "0x1",
        original_event_index: "0x1",
        extrinsic_index: "0xabc",
        module_id: "balances",
        event_id: "Deposit",
      },
    ];

    (subscanServiceMock.fetchEventDetails as jest.Mock<any>).mockResolvedValue(
      eventDetails,
    );

    const result = await service.handleEvents(
      { domain: "energywebx", token: "EWT" },
      mockEvents,
      [], // no xcm transfers
    );

    expect(result).toEqual([{ extrinsic_index: "0x123", amount: 1000 }]);

    expect(subscanServiceMock.fetchEventDetails).toHaveBeenCalledWith(
      "energywebx",
      [mockEvents[0]],
    );
  });
});
