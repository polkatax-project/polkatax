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

describe("staking rewards via reward_slash endpoint", () => {
  let fastiyInstances: FastifyInstance[] = [];
  let server: SetupServerApi;
  let wsWrapper: WsWrapper;

  let year: number = new Date().getFullYear() - 1;
  const createDefaultHandlers = () => {
    return [...passThroughHandlers, scanTokenHandler];
  };

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

  test("simple example with only 1 reward", async () => {
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
      "https://polkadot.api.subscan.io/api/scan/account/reward_slash",
      [
        {
          data: { list: mockStakingRewards as any },
        },
      ],
    );

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
    const msg = wsWrapper.receivedMessages;

    expect(msg[0].reqId).toBe("xyz");
    expect(msg[0].payload.length).toBe(1);
    expect(msg[1].payload.length).toBe(1);
    expect(msg[1].payload[0].status).toBe("in_progress");
    expect(msg[2].payload[0].status).toBe("done");
    expect(msg[2].payload[0].data).toEqual({
      values: [
        {
          block: "999",
          timestamp: mockStakingRewards[0].block_timestamp * 1000,
          amount: 123,
          extrinsic_index: expect.any(String),
          hash: "0xa",
          price: 10,
          fiatValue: 1230,
        },
      ],
      token: "DOT",
    });
  });

  test("example with multiple rewards and a slashing", async () => {
    const mockStakingRewards = [
      {
        event_id: "Reward",
        amount: "1000000000000",
        block_timestamp: new Date(`${year}-04-04 00:00:00`).getTime() / 1000,
        extrinsic_index: "999-6",
        extrinsic_hash: "0xa",
      },
      {
        event_id: "Reward",
        amount: "2000000000000",
        block_timestamp:
          new Date(`${year - 2}-04-04 00:00:00`).getTime() / 1000, // shoud be removed due to timestamp
        extrinsic_index: "997-6",
        extrinsic_hash: "0xb",
      },
      {
        event_id: "Reward",
        amount: "2000000000000",
        block_timestamp: new Date(`${year}-02-04 00:00:00`).getTime() / 1000,
        extrinsic_index: "997-6",
        extrinsic_hash: "0xb",
      },
      {
        event_id: "Slash",
        amount: "3000000000000",
        block_timestamp: new Date(`${year}-07-12 00:00:00`).getTime() / 1000,
        extrinsic_index: "998-6",
        extrinsic_hash: "0xc",
      },
    ];

    const rewardsAndSlashMock = createPaginatedMockResponseHandler(
      "https://polkadot.api.subscan.io/api/scan/account/reward_slash",
      [
        {
          data: { list: mockStakingRewards as any },
        },
      ],
    );

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
    const msg = wsWrapper.receivedMessages;

    expect(msg[2].payload[0].status).toBe("done");
    expect(msg[2].payload[0].data).toEqual({
      values: [
        {
          block: "999",
          timestamp: mockStakingRewards[0].block_timestamp * 1000,
          amount: 100,
          extrinsic_index: expect.any(String),
          hash: "0xa",
          price: 10,
          fiatValue: 1000,
        },
        {
          block: "997",
          timestamp: mockStakingRewards[2].block_timestamp * 1000,
          amount: 200,
          extrinsic_index: expect.any(String),
          hash: "0xb",
          price: 10,
          fiatValue: 2000,
        },
        {
          block: "998",
          timestamp: mockStakingRewards[3].block_timestamp * 1000,
          amount: -300,
          extrinsic_index: expect.any(String),
          hash: "0xc",
          price: 10,
          fiatValue: -3000,
        },
      ],
      token: "DOT",
    });
  });

  test("example with more than 100 rewards", async () => {
    const createRewards = (counter) => {
      return Array.from({ length: counter }, (_, i) => {
        return {
          event_id: "Reward",
          amount: "1000000000000",
          block_timestamp: new Date(`${year}-02-04 00:00:00`).getTime() / 1000,
          extrinsic_index: "999-6",
          extrinsic_hash: String(i),
        };
      });
    };

    const rewardsAndSlashMock = createPaginatedMockResponseHandler(
      "https://polkadot.api.subscan.io/api/scan/account/reward_slash",
      [
        { data: { list: createRewards(100) } },
        { data: { list: createRewards(70) } },
      ],
    );

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
    const msg = wsWrapper.receivedMessages;

    expect(msg[2].payload[0].status).toBe("done");
    expect(msg[2].payload[0].data.values.length).toBe(170);
  });

  afterEach(async () => {
    if (wsWrapper) {
      await wsWrapper.close();
    }
    if (server) {
      server.resetHandlers();
      server.close();
    }
    for (let fastiyInstance of fastiyInstances) {
      await fastiyInstance.close();
    }
  });
});
