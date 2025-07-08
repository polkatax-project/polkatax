import { JobManager } from "../job-management/job.manager";
import { JobRepository } from "../job-management/job.repository";
import { StakingRewardsWithFiatService } from "../data-aggregation/services/staking-rewards-with-fiat.service";
import { WebSocketIncomingMessage } from "./incoming-message-schema";
import { expect, it, jest, describe, beforeEach } from "@jest/globals";
import { WebSocketManager } from "./websocket.manager";

const mockSocket = {
  send: jest.fn(),
} as any;

describe("WebSocketManager", () => {
  let jobManager: jest.Mocked<JobManager>;
  let jobRepository: jest.Mocked<JobRepository>;
  let stakingRewardsWithFiatService: jest.Mocked<StakingRewardsWithFiatService>;
  let manager: WebSocketManager;

  beforeEach(() => {
    jobManager = {
      enqueue: jest.fn(),
      getStakingChains: jest.fn<any>().mockReturnValue(["polkadot"]),
    } as any;

    jobRepository = {
      jobChanged$: {
        subscribe: jest.fn<any>(),
      },
      findJob: jest.fn<any>(),
    } as any;

    stakingRewardsWithFiatService = {
      fetchStakingRewardsViaPlatformApi: jest.fn(),
    } as any;

    manager = new WebSocketManager(
      jobManager,
      jobRepository,
      stakingRewardsWithFiatService,
    );

    process.env["USE_DATA_PLATFORM_API"] = "true"; // To trigger platform API fetch
    mockSocket.send.mockClear();
  });

  it("handles fetchDataRequest and sends initial + aggregated rewards", async () => {
    const reqId = "123";
    const wallet = "0xabc";
    const currency = "usd";

    const msg: WebSocketIncomingMessage = {
      type: "fetchDataRequest",
      reqId,
      payload: {
        wallet,
        currency,
        blockchains: ["polkadot"],
      },
    };

    const mockJobs = [
      {
        wallet,
        status: "done",
        data: {},
        lastModified: Date.now(),
        blockchain: "polkadot",
        currency,
        reqId,
      },
    ];

    const mockAggregated = [
      {
        token: "DOT",
        currency,
        chain: "polkadot",
        values: [{ amount: 5 }],
      },
    ];

    stakingRewardsWithFiatService.fetchStakingRewardsViaPlatformApi.mockResolvedValue(
      mockAggregated as any,
    );
    jobManager.enqueue.mockResolvedValue(mockJobs as any);

    const response = await manager["handleFetchDataRequest"](mockSocket, msg);

    // Called to fetch from platform API and send partial results
    expect(
      stakingRewardsWithFiatService.fetchStakingRewardsViaPlatformApi,
    ).toHaveBeenCalledWith(wallet, currency);

    expect(mockSocket.send).toHaveBeenCalledWith(
      expect.stringContaining('"status":"in_progress"'),
    );
    expect(mockSocket.send).toHaveBeenCalledWith(
      expect.stringContaining('"status":"done"'),
    );

    expect(response).toEqual({
      type: "data",
      reqId,
      payload: mockJobs,
      timestamp: expect.any(Number),
    });

    // Subscription should be added
    expect((manager as any).connections).toContainEqual({
      socket: mockSocket,
      subscription: { wallet, currency },
    });
  });

  it("limits subscription to 4 wallets per socket (isThrottled)", () => {
    const socket = {} as any;
    const wsManager = new WebSocketManager(
      jobManager,
      jobRepository,
      stakingRewardsWithFiatService,
    );
    const wallets = ["a", "b", "c", "d"];

    for (const wallet of wallets) {
      (wsManager as any).connections.push({
        socket,
        subscription: { wallet, currency: "usd" },
      });
    }

    const msg: WebSocketIncomingMessage = {
      type: "fetchDataRequest",
      reqId: "999",
      payload: {
        wallet: "e",
        currency: "usd",
        blockchains: ["kusama"],
      },
    };

    const result = (wsManager as any).isThrottled(socket, msg);
    expect(result).toBe(true);
  });
});
