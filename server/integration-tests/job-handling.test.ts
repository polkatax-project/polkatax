import { describe, test, beforeEach, afterEach, expect } from "@jest/globals";
import { polkataxServer } from "../src/server/polkatax-server";
import { setupServer, SetupServerApi } from "msw/node";
import { startStub as startPricesStub } from "../src/crypto-currency-prices/stub";
import { startStub as startFiatStub } from "../src/fiat-exchange-rates/stub";
import { FastifyInstance } from "fastify";
import { passThroughHandlers } from "./util/pass-through-handlers";
import { scanTokenHandler } from "./util/scan-token-handler";
import { createPaginatedMockResponseHandler } from "./util/create-paginated-mock-response-handler";
import { WsWrapper } from "./util/ws-wrapper";
import { http, HttpResponse } from "msw";

describe("Proper handling of jobs", () => {
  let fastiyInstances: FastifyInstance[] = [];
  let server: SetupServerApi;
  let wsWrapper: WsWrapper;

  let year = new Date().getFullYear() - 1;
  const createDefaultHandlers = () => {
    return [...passThroughHandlers, scanTokenHandler];
  };

  const mockStakingRewards = [
    {
      event_id: "Reward",
      amount: "1230000000000",
      block_timestamp: new Date(`${year}-04-04 00:00:00`).getTime() / 1000,
      extrinsic_index: "999-6",
      extrinsic_hash: "0xa",
    },
  ];

  const rewardsAndSlashMock = createPaginatedMockResponseHandler(
    "https://*.api.subscan.io/api/scan/account/reward_slash",
    [
      {
        data: { list: mockStakingRewards as any },
      },
    ],
  );

  beforeEach(async () => {
    process.env["SUBSCAN_API_KEY"] = "bla";
    fastiyInstances.push(
      ...[
        await polkataxServer.init(),
        await startPricesStub(),
        await startFiatStub(),
      ],
    );
  });

  test("request data from two chains", async () => {
    server = setupServer(...createDefaultHandlers(), rewardsAndSlashMock);
    await server.listen();
    wsWrapper = new WsWrapper();
    await wsWrapper.connect();
    wsWrapper.send({
      type: "fetchDataRequest",
      reqId: "xyz",
      timestamp: 0,
      payload: {
        wallet: "2Fd1UGzT8yuhksiKy98TpDg794dEELvNFqenJjRHFvwfuU83",
        currency: "USD",
        blockchains: ["polkadot", "kusama"],
      },
    });
    await wsWrapper.waitForNMessages(5);

    const msgForBothChains = wsWrapper.receivedMessages.find(
      (m) => m.payload.length === 2,
    );
    const blockChains = msgForBothChains.payload.map((data) => data.blockchain);
    expect(blockChains).toEqual(["polkadot", "kusama"]);

    const kusamaMessages = wsWrapper.receivedMessages.filter(
      (m) => m.payload.length === 1 && m.payload[0].blockchain === "kusama",
    );
    expect(kusamaMessages.length).toBe(2);
    expect(kusamaMessages[0].payload[0].status).toBe("in_progress");
    expect(kusamaMessages[1].payload[0].status).toBe("done");

    const polkadotMessages = wsWrapper.receivedMessages.filter(
      (m) => m.payload.length === 1 && m.payload[0].blockchain === "polkadot",
    );
    expect(polkadotMessages.length).toBe(2);
    expect(polkadotMessages[0].payload[0].status).toBe("in_progress");
    expect(polkadotMessages[1].payload[0].status).toBe("done");
  });

  test("should cache jobs", async () => {
    server = setupServer(...createDefaultHandlers(), rewardsAndSlashMock);
    await server.listen();
    wsWrapper = new WsWrapper();
    await wsWrapper.connect();
    wsWrapper.send({
      type: "fetchDataRequest",
      reqId: "xyz",
      timestamp: 0,
      payload: {
        wallet: "2Fd1UGzT8yuhksiKy98TpDg794dEELvNFqenJjRHFvwfuU83",
        currency: "USD",
        blockchains: ["polkadot"],
      },
    });
    await wsWrapper.waitForNMessages(3);
    expect(wsWrapper.receivedMessages[2].payload[0].status).toBe("done");

    wsWrapper.send({
      type: "fetchDataRequest",
      reqId: "xyz",
      timestamp: 0,
      payload: {
        wallet: "2Fd1UGzT8yuhksiKy98TpDg794dEELvNFqenJjRHFvwfuU83",
        currency: "USD",
        blockchains: ["polkadot"],
      },
    });
    await wsWrapper.waitForNMessages(1);
    expect(wsWrapper.receivedMessages[3].payload[0].status).toBe("done");
  });

  test("handle errors", async () => {
    const errorMock = http.post(
      "https://*.api.subscan.io/api/scan/account/reward_slash",
      () => {
        return HttpResponse.json(
          {
            error: "Just testing error handling. Don't worry about this error.",
          },
          { status: 400 },
        );
      },
    );
    server = setupServer(...passThroughHandlers, scanTokenHandler, errorMock);

    await server.listen();
    wsWrapper = new WsWrapper();
    await wsWrapper.connect();
    wsWrapper.send({
      type: "fetchDataRequest",
      reqId: "xyz",
      timestamp: 0,
      payload: {
        wallet: "2Fd1UGzT8yuhksiKy98TpDg794dEELvNFqenJjRHFvwfuU83",
        currency: "USD",
        blockchains: ["polkadot"],
      },
    });
    await wsWrapper.waitForNMessages(3);

    expect(wsWrapper.receivedMessages[2].payload[0].status).toBe("error");
    expect(wsWrapper.receivedMessages[2].payload[0].error.code).toBe(400);
  });

  test("handle invalid wallet address", async () => {
    server = setupServer(...passThroughHandlers);

    await server.listen();
    wsWrapper = new WsWrapper();
    await wsWrapper.connect();
    wsWrapper.send({
      type: "fetchDataRequest",
      reqId: "xyz",
      timestamp: 0,
      payload: {
        wallet: "invalid-address",
        currency: "USD",
        blockchains: ["polkadot"],
      },
    });
    await wsWrapper.waitForNMessages(1);
    expect(wsWrapper.receivedMessages[0].error).not.toBeUndefined();
    expect(wsWrapper.receivedMessages[0].error.code).toBe(400);
  });

  test("retry failed jobs", async () => {
    const errorMock = http.post(
      "https://*.api.subscan.io/api/scan/account/reward_slash",
      () => {
        return HttpResponse.json(
          {
            error: "Just testing error handling. Don't worry about this error.",
          },
          { status: 400 },
        );
      },
    );
    server = setupServer(
      ...[...passThroughHandlers, scanTokenHandler],
      errorMock,
    );
    await server.listen();

    wsWrapper = new WsWrapper();
    await wsWrapper.connect();
    wsWrapper.send({
      type: "fetchDataRequest",
      reqId: "xyz",
      timestamp: 0,
      payload: {
        wallet: "2Fd1UGzT8yuhksiKy98TpDg794dEELvNFqenJjRHFvwfuU83",
        currency: "USD",
        blockchains: ["polkadot"],
      },
    });
    await wsWrapper.waitForNMessages(3);
    expect(wsWrapper.receivedMessages[2].payload[0].status).toBe("error");

    wsWrapper.send({
      type: "fetchDataRequest",
      reqId: "xyz",
      timestamp: 0,
      payload: {
        wallet: "2Fd1UGzT8yuhksiKy98TpDg794dEELvNFqenJjRHFvwfuU83",
        currency: "USD",
        blockchains: ["polkadot"],
      },
    });
    await wsWrapper.waitForNMessages(3);
    expect(wsWrapper.receivedMessages[4].payload[0].status).toBe("in_progress");
  });

  test("should perform round robin", async () => {
    server = setupServer(
      ...createDefaultHandlers(),
      scanTokenHandler,
      rewardsAndSlashMock,
    );
    await server.listen();
    wsWrapper = new WsWrapper();
    await wsWrapper.connect();

    // Send first fetchDataRequest (multiple blockchains)
    wsWrapper.send({
      type: "fetchDataRequest",
      reqId: "xyz",
      timestamp: 0,
      payload: {
        wallet: "Dnn4xiYdgz3bdRWQaUsvX5noNpcUwmqomKgHg8xzZL1vzfq",
        currency: "USD",
        blockchains: ["polkadot", "kusama", "hydration"],
      },
    });

    // Send second fetchDataRequest (single blockchain)
    wsWrapper.send({
      type: "fetchDataRequest",
      reqId: "abc",
      timestamp: 0,
      payload: {
        wallet: "EUKqtB33pRN2cgru8WXiz4zAuZUn4YRuWG25AZqjzPAdVvJ",
        currency: "USD",
        blockchains: ["polkadot"],
      },
    });

    // Each request results in:
    // - 1 message confirming request receipt
    // - 1 message for status "in_progress"
    // - 1 message for status "done"
    // So we expect 6 messages in total until 2 jobs are done
    await wsWrapper.waitForNMessages(6);
    const completedJobs = wsWrapper.receivedMessages.filter(
      (msg) => msg.payload[0].status === "done",
    );
    expect(completedJobs.length).toBe(2);

    // Ensure that the two completed jobs are for different wallets
    expect(
      completedJobs[0].payload[0].wallet !== completedJobs[1].payload[0].wallet,
    ).toBe(true);

    // expect 4 more messages for the remaining two jobs...
    await wsWrapper.waitForNMessages(4);
  }, 15000);

  afterEach(async () => {
    if (wsWrapper) {
      await wsWrapper.close();
    }
    for (let fastiyInstance of fastiyInstances) {
      await fastiyInstance.close();
    }
    if (server) {
      server.resetHandlers();
      server.close();
    }
  });
});
