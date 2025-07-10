import { DataPlatformService } from "./data-platform.service";
import { DataPlatformApi } from "./data-platform.api";
import { SubscanService } from "../blockchain/substrate/api/subscan.service";
import { dataPlatformChains } from "./model/data-platform-chains";
import * as addressUtils from "../../common/util/convert-to-generic-address";
import * as isValidAddressUtil from "../../common/util/is-valid-address";
import { jest, describe, beforeEach, it, expect } from "@jest/globals";

jest.mock("../logger/logger", () => ({
  logger: {
    info: jest.fn(),
  },
}));

describe("DataPlatformService", () => {
  let service: DataPlatformService;
  let dataPlatformApi: jest.Mocked<DataPlatformApi>;
  let subscanService: jest.Mocked<SubscanService>;

  beforeEach(() => {
    dataPlatformApi = {
      fetch: jest.fn(),
    } as any;

    subscanService = {
      fetchNativeTokens: jest.fn(),
    } as any;

    service = new DataPlatformService(dataPlatformApi, subscanService);

    jest.spyOn(isValidAddressUtil, "isValidEvmAddress").mockReturnValue(false);
    jest
      .spyOn(addressUtils, "convertToGenericAddress")
      .mockReturnValue("GENERIC_ADDR");
  });

  it("should fetch and return aggregated staking rewards", async () => {
    const mockChains = dataPlatformChains.slice(0, 2); // simplify test
    const mockDomainA = mockChains[0].domain;
    const mockDomainB = mockChains[1].domain;

    // Mock SubscanService
    subscanService.fetchNativeTokens.mockResolvedValue({
      [mockDomainA]: { token_decimals: 12 },
      [mockDomainB]: { token_decimals: 10 },
    } as any);

    // Mock API data
    dataPlatformApi.fetch.mockResolvedValue({
      items: [
        {
          chainType: mockChains[0].chainType,
          stakingResults: [
            { totalAmount: "1000000000000", executionDate: "2024-07-01" },
          ],
          nominationPoolResults: [
            { totalAmount: "2000000000000", executionDate: "2024-07-02" },
          ],
        } as any,
      ],
    });

    const result = await service.fetchAggregatedStakingRewards("SOME_ADDRESS");

    expect(isValidAddressUtil.isValidEvmAddress).toHaveBeenCalledWith(
      "SOME_ADDRESS",
    );
    expect(addressUtils.convertToGenericAddress).toHaveBeenCalledWith(
      "SOME_ADDRESS",
    );
    expect(dataPlatformApi.fetch).toHaveBeenCalledWith(
      "GENERIC_ADDR",
      expect.any(String),
      expect.any(String),
    );
    expect(subscanService.fetchNativeTokens).toHaveBeenCalled();

    expect(result).toHaveLength(4);

    const first = result[0];
    expect(first.chain).toBe(mockDomainA);
    expect(first.values).toEqual([
      {
        amount: 1,
        timestamp: new Date("2024-07-01T23:59:59.999Z").getTime(),
        isoDate: "2024-07-01",
      },
      {
        amount: 2,
        timestamp: new Date("2024-07-02T23:59:59.999Z").getTime(),
        isoDate: "2024-07-02",
        nominationPool: true,
      },
    ]);

    const second = result[1];
    expect(second.chain).toBe(mockDomainB);
    expect(second.values).toEqual([]);
  });
});
