import { JobManager } from "../job-management/job.manager";
import * as WebSocket from "ws";
import { WebSocketOutgoingMessage } from "../model/web-socket-msg";
import { logger } from "../logger/logger";
import { WsError } from "../model/ws-error";
import {
  WebSocketIncomingMessage,
  WebSocketIncomingMessageSchema,
} from "./incoming-message-schema";
import { JobRepository } from "../job-management/job.repository";
import { convertToCanonicalAddress } from "../../common/util/convert-to-canonical-address";
import { isValidEvmAddress } from "../../common/util/is-valid-address";
import * as subscanChains from "../../../res/gen/subscan-chains.json";
import { createJobId } from "../job-management/helper/create-job-id";
import {
  getBeginningLastYear,
  getEndOfLastYear,
} from "../job-management/get-beginning-last-year";
import { Job } from "../../model/job";

interface Subscription {
  jobId: string;
  wallet: string;
}

export class WebSocketManager {
  private connections: { subscription: Subscription; socket: WebSocket }[] = [];
  private readonly MAX_WALLETS = 4;

  constructor(
    private jobManager: JobManager,
    private jobRepository: JobRepository,
  ) {}

  private match(
    sub1: Partial<Subscription>,
    sub2: Partial<Subscription>,
  ): boolean {
    return sub1.jobId === sub2.jobId;
  }

  private addSubscription(socket: WebSocket, sub: Subscription) {
    const alreadySubscribed = this.connections.some(
      (c) => c.socket === socket && this.match(c.subscription, sub),
    );
    if (!alreadySubscribed) {
      this.connections.push({ socket, subscription: sub });
    }
  }

  private removeSubscription(socket: WebSocket, sub: Subscription) {
    this.connections = this.connections.filter(
      (c) => c.socket !== socket || !this.match(c.subscription, sub),
    );
  }

  private async handleFetchDataRequest(
    socket: WebSocket,
    msg: WebSocketIncomingMessage,
  ): Promise<void> {
    const { wallet, currency, blockchains, syncFromDate, syncUntilDate } =
      msg.payload;

    /*if (
      Math.abs(syncFromDate - getBeginningLastYear()) > 25 * 60 * 60 * 1000 ||
      Math.abs(syncUntilDate - getEndOfLastYear()) > 25 * 60 * 60 * 1000
    ) {
      this.sendError(socket, {
        code: 400,
        msg: "Sync date invalid",
      });
      return;
    }*/

    const jobs = await this.jobManager.enqueue(
      msg.reqId,
      wallet,
      currency,
      syncFromDate,
      syncUntilDate,
      blockchains,
    );

    jobs.forEach((job) => {
      this.addSubscription(socket, { jobId: job.id, wallet: job.wallet });
      this.sentJobToClients(job);
    });
  }

  private async handleUnsubscribeRequest(
    socket: WebSocket,
    msg: WebSocketIncomingMessage,
  ): Promise<void> {
    const { wallet, currency, syncFromDate, syncUntilDate } = msg.payload;
    subscanChains.chains.forEach((chain) => {
      this.removeSubscription(socket, {
        wallet,
        jobId: createJobId({
          wallet,
          currency,
          syncFromDate,
          syncUntilDate,
          blockchain: chain.domain,
        }),
      });
    });

    logger.info(
      `Confirming unsubscribe request with reqId: ${msg.reqId}, type: ${msg.type}`,
    );
    socket.send(
      JSON.stringify({
        type: "acknowledgeUnsubscribe",
        reqId: msg.reqId,
        payload: [],
        timestamp: Date.now(),
      }),
    );
  }

  private async handleMessage(
    socket: WebSocket,
    msg: WebSocketIncomingMessage,
  ): Promise<void> {
    if (msg.type === "fetchDataRequest" && this.isThrottled(socket, msg)) {
      return this.sendError(socket, {
        code: 429,
        msg: "You cannot add more than 4 wallets to sync.",
      });
    }

    switch (msg.type) {
      case "fetchDataRequest":
        await this.handleFetchDataRequest(socket, msg);
        break;
      case "unsubscribeRequest":
        await this.handleUnsubscribeRequest(socket, msg);
    }
  }

  private isThrottled(
    socket: WebSocket,
    msg: WebSocketIncomingMessage,
  ): boolean {
    const wallets = [
      ...new Set(
        this.connections
          .filter((c) => c.socket === socket)
          .map((c) => c.subscription.wallet),
      ),
    ];

    return (
      !wallets.includes(msg.payload.wallet) &&
      wallets.length >= this.MAX_WALLETS
    );
  }

  private sendError(socket: WebSocket, error: WsError): void {
    socket.send(
      JSON.stringify({ type: "error", timestamp: Date.now(), error }),
    );
  }

  wsHandler = (socket: WebSocket): void => {
    (socket as any).isAlive = true;

    socket.on("pong", () => {
      (socket as any).isAlive = true;
    });

    socket.on("message", async (raw) => {
      let msg: WebSocketIncomingMessage;
      try {
        msg = JSON.parse(raw.toString());
        logger.info(msg, "WebSocketManager: received msg.");
      } catch (err) {
        logger.info(err, "Invalid JSON received");
        return this.sendError(socket, { code: 400, msg: "Invalid JSON" });
      }

      const result = WebSocketIncomingMessageSchema.safeParse(msg);
      if (!result.success) {
        return this.sendError(socket, { code: 400, msg: "Invalid message" });
      }

      if (
        result.data.payload?.wallet &&
        !isValidEvmAddress(result.data.payload.wallet)
      ) {
        result.data.payload.wallet = convertToCanonicalAddress(
          result.data.payload.wallet,
        );
      }

      try {
        await this.handleMessage(socket, result.data);
      } catch (err) {
        logger.error("Message handling failed");
        logger.error(err);
        this.sendError(socket, {
          code: 500,
          msg: "Error processing message",
        });
      }
    });

    socket.on("close", () => {
      logger.info("WebSocketManager: client disconnected");
      this.connections = this.connections.filter((c) => c.socket !== socket);
    });
  };

  async startJobNotificationChannel(): Promise<void> {
    this.jobRepository.jobChanged$.subscribe(async (jobId: string) => {
      const job = await this.jobRepository.findJob(jobId);
      if (job.status === "post_processing") {
        return; // only pending - processing - done is relevant for the client.
      }
      this.sentJobToClients(job);
    });
  }

  private sentJobToClients(job: Job) {
    const matches = this.connections.filter((c) =>
      this.match(c.subscription, { jobId: job.id }),
    );
    if (!matches.length) return;

    const jobDataValues =
      job?.data?.values && job.status !== "post_processing"
        ? job.data.values
        : undefined;

    const message: WebSocketOutgoingMessage = {
      reqId: job.reqId,
      payload: [
        {
          ...job,
          data:
            job.data && job.status !== "post_processing"
              ? {
                  ...job.data,
                  values: jobDataValues,
                }
              : undefined,
        },
      ],
      timestamp: Date.now(),
      type: "data",
    };

    matches.forEach((c) => {
      logger.info(`Notifying wallet ${c.subscription.wallet}`);
      c.socket.send(JSON.stringify(message));
    });
  }
}
