import { expect, it, jest, describe, beforeEach } from "@jest/globals";

import { JobManager } from "../job-management/job.manager";
import { JobRepository } from "../job-management/job.repository";
import { Job } from "../../model/job";
import { WebSocketIncomingMessage } from "./incoming-message-schema";
import * as WebSocket from "ws";
import { WebSocketManager } from "./websocket.manager";
import { Subject } from "rxjs";

jest.mock("../logger/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../common/util/is-valid-address", () => ({
  isValidEvmAddress: jest.fn(() => true),
}));

jest.mock("../../common/util/convert-to-generic-address", () => ({
  convertToCanonicalAddress: jest.fn((addr) => addr),
}));

describe("WebSocketManager", () => {
  let wsManager: WebSocketManager;
  let mockJobManager: jest.Mocked<JobManager>;
  let mockJobRepository: jest.Mocked<JobRepository>;
  let mockSocket: Partial<WebSocket>;

  beforeEach(() => {
    mockJobManager = {
      enqueue: jest.fn(),
      getStakingChains: jest.fn<any>(() => ["chainA"]),
    } as any;

    mockJobRepository = {
      jobChanged$: new Subject(),
      findJob: jest.fn<any>(),
    } as any;

    wsManager = new WebSocketManager(mockJobManager, mockJobRepository);

    mockSocket = {
      send: jest.fn<any>(),
      on: jest.fn<any>(),
    };
  });

  describe("isThrottled", () => {
    it("should allow up to MAX_WALLETS per socket", () => {
      const socket = {} as WebSocket;
      const wallets = ["w1", "w2", "w3"];
      wallets.forEach((wallet) =>
        (wsManager as any).connections.push({
          socket,
          subscription: { wallet, currency: "ETH" },
        }),
      );

      const msg = {
        payload: { wallet: "w4" },
      } as WebSocketIncomingMessage;

      expect(wsManager["isThrottled"](socket, msg)).toBe(false);

      // Add fourth
      (wsManager as any).connections.push({
        socket,
        subscription: { wallet: "w4", currency: "ETH" },
      });

      expect(
        wsManager["isThrottled"](socket, { payload: { wallet: "w5" } } as any),
      ).toBe(true);
    });
  });

  describe("handleFetchDataRequest", () => {
    it("adds subscription and returns data message", async () => {
      const jobs = [{ reqId: "req123" }];
      mockJobManager.enqueue.mockResolvedValue(jobs as any);

      const msg: WebSocketIncomingMessage = {
        type: "fetchDataRequest",
        reqId: "req123",
        payload: {
          wallet: "wallet1",
          currency: "ETH",
          blockchains: ["chainA"],
        },
      };

      const result = await (wsManager as any).handleFetchDataRequest(
        mockSocket as any,
        msg,
      );

      expect(result.type).toBe("data");
      expect(result.reqId).toBe("req123");
      expect(result.payload).toEqual(jobs);
    });
  });

  describe("handleUnsubscribeRequest", () => {
    it("removes subscription and sends ack", async () => {
      const msg: WebSocketIncomingMessage = {
        type: "unsubscribeRequest",
        reqId: "req-unsub",
        payload: { wallet: "wallet1", currency: "ETH" },
      };

      const result = await (wsManager as any).handleUnsubscribeRequest(
        mockSocket as any,
        msg,
      );

      expect(result.type).toBe("acknowledgeUnsubscribe");
      expect(result.reqId).toBe("req-unsub");
    });
  });

  describe("handleMessage", () => {
    it("routes fetchDataRequest", async () => {
      const msg: WebSocketIncomingMessage = {
        type: "fetchDataRequest",
        reqId: "req1",
        payload: { wallet: "w", currency: "ETH", blockchains: ["b"] },
      };

      mockJobManager.enqueue.mockResolvedValue([{ reqId: "req1" }] as any);

      const response = await (wsManager as any).handleMessage(
        mockSocket as any,
        msg,
      );
      expect(response.type).toBe("data");
    });

    it("sends 429 if throttled", async () => {
      const socket = { send: jest.fn() } as any;
      for (let i = 0; i < 4; i++) {
        (wsManager as any).connections.push({
          socket,
          subscription: { wallet: `w${i}`, currency: "ETH" },
        });
      }

      const msg = {
        type: "fetchDataRequest",
        payload: { wallet: "w5", currency: "ETH" },
      };

      await (wsManager as any).handleMessage(socket, msg);

      expect(socket.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":429'),
      );
    });
  });

  describe("sendError", () => {
    it("sends error as JSON", () => {
      const socket = { send: jest.fn() } as any;
      wsManager["sendError"](socket, { code: 400, msg: "Bad" });

      expect(socket.send).toHaveBeenCalledWith(
        expect.stringContaining('"msg":"Bad"'),
      );
    });
  });

  describe("startJobNotificationChannel", () => {
    it("sends data to matching connections", async () => {
      const job: Job = {
        reqId: "r1",
        wallet: "w1",
        blockchain: "eth",
        currency: "ETH",
        status: "pending",
        lastModified: Date.now(),
        syncFromDate: Date.now(),
        data: {},
      };

      const fakeSocket = { send: jest.fn() } as any;
      (wsManager as any).connections = [
        {
          socket: fakeSocket,
          subscription: { wallet: "w1", currency: "ETH" },
        },
        {
          socket: { send: jest.fn() },
          subscription: { wallet: "other", currency: "BTC" },
        },
      ];

      const jobId = {
        wallet: "w1",
        currency: "ETH",
        blockchain: "eth",
      };

      await wsManager.startJobNotificationChannel();

      mockJobRepository.findJob.mockResolvedValue(job);

      mockJobRepository.jobChanged$.next(jobId);

      /**
       * Workaround for addressing async handling of job notification channel
       */
      await new Promise((resolve) => setImmediate(resolve));

      expect(fakeSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"data"'),
      );
    });
  });
});
