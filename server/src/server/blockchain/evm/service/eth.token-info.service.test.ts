import { expect, it, jest, describe, beforeEach } from "@jest/globals";

// Mocks for contract method calls
const mockSymbolCall = jest.fn<any>();
const mockDecimalsCall = jest.fn<any>();

const mockContract = {
  methods: {
    symbol: jest.fn(() => ({ call: mockSymbolCall })),
    decimals: jest.fn(() => ({ call: mockDecimalsCall })),
  },
};

// Custom mock Web3 class
class MockWeb3 {
  eth = {
    Contract: jest.fn(() => mockContract),
  };

  constructor() {}
}

// Replace the real Web3 with our mock
jest.mock("web3", () => {
  return jest.fn().mockImplementation(() => new MockWeb3());
});

import { EthTokenInfoService } from "./eth.token-info.service";

describe("EthTokenInfoService", () => {
  let service: EthTokenInfoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EthTokenInfoService();
  });

  it("should return ETH info for zero address", async () => {
    const result = await service.fetchTokenInfo(
      "0x0000000000000000000000000000000000000000",
    );
    expect(result).toEqual({ symbol: "ETH", decimals: 18 });
  });

  it("should fetch token info from contract and cache it", async () => {
    const testAddress = "0xabc123abc123abc123abc123abc123abc123abcd";
    mockSymbolCall.mockResolvedValue("DAI");
    mockDecimalsCall.mockResolvedValue("18");

    const result = await service.fetchTokenInfo(testAddress);

    expect(mockContract.methods.symbol).toHaveBeenCalled();
    expect(mockContract.methods.decimals).toHaveBeenCalled();
    expect(result).toEqual({ symbol: "DAI", decimals: 18 });

    // Second call should hit the cache, no new calls
    const cachedResult = await service.fetchTokenInfo(testAddress);
    expect(mockContract.methods.symbol).toHaveBeenCalledTimes(1);
    expect(mockContract.methods.decimals).toHaveBeenCalledTimes(1);
    expect(cachedResult).toEqual({ symbol: "DAI", decimals: 18 });
  });
});
