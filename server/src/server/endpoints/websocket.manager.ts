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
import { JobId } from "../../model/job";
import { convertToCanonicalAddress } from "../../common/util/convert-to-generic-address";
import { isValidEvmAddress } from "../../common/util/is-valid-address";

interface Subscription {
  wallet: string;
  currency: string;
}

export class WebSocketManager {
  private connections: { subscription: Subscription; socket: WebSocket }[] = [];
  private readonly MAX_WALLETS = 4;

  constructor(
    private jobManager: JobManager,
    private jobRepository: JobRepository,
  ) {}

  private match(sub1: Subscription, sub2: Subscription): boolean {
    return sub1.wallet === sub2.wallet && sub1.currency === sub2.currency;
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
  ): Promise<WebSocketOutgoingMessage> {
    const { wallet, currency, blockchains } = msg.payload;
    const subscription = { wallet, currency };

    this.addSubscription(socket, subscription);

    const jobs = await this.jobManager.enqueue(
      msg.reqId,
      wallet,
      currency,
      blockchains,
    );

    return {
      type: "data",
      reqId: msg.reqId,
      payload: jobs,
      timestamp: Date.now(),
    };
  }

  private async handleUnsubscribeRequest(
    socket: WebSocket,
    msg: WebSocketIncomingMessage,
  ): Promise<WebSocketOutgoingMessage> {
    const { wallet, currency } = msg.payload;
    this.removeSubscription(socket, { wallet, currency });

    return {
      type: "acknowledgeUnsubscribe",
      reqId: msg.reqId,
      payload: [],
      timestamp: Date.now(),
    };
  }

  private async handleMessage(
    socket: WebSocket,
    msg: WebSocketIncomingMessage,
  ): Promise<WebSocketOutgoingMessage | void> {
    if (msg.type === "fetchDataRequest" && this.isThrottled(socket, msg)) {
      return this.sendError(socket, {
        code: 429,
        msg: "You cannot add more than 4 wallets to sync.",
      });
    }

    switch (msg.type) {
      case "fetchDataRequest":
        return this.handleFetchDataRequest(socket, msg);
      case "unsubscribeRequest":
        return this.handleUnsubscribeRequest(socket, msg);
    }
  }

  private isThrottled(
    socket: WebSocket,
    msg: WebSocketIncomingMessage,
  ): boolean {
    const wallets = this.connections
      .filter((c) => c.socket === socket)
      .map((c) => c.subscription.wallet);

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
    socket.on("message", async (raw) => {
      logger.info("WebSocketManager: received msg: " + raw);

      let msg: WebSocketIncomingMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch (err) {
        logger.info("Invalid JSON received", err);
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
        const response = await this.handleMessage(socket, result.data);
        if (response) {
          logger.info(
            `Sending response reqId: ${response.reqId}, type: ${response.type}, payload.length: ${response.payload.length}`,
          );
          socket.send(JSON.stringify(response));
        }
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
    this.jobRepository.jobChanged$.subscribe(async (jobId: JobId) => {
      const matches = this.connections.filter((c) =>
        this.match(c.subscription, {
          wallet: jobId.wallet,
          currency: jobId.currency,
        }),
      );

      if (!matches.length) return;

      const job = await this.jobRepository.findJob(jobId);
      const message: WebSocketOutgoingMessage = {
        reqId: job.reqId,
        payload: [job],
        timestamp: Date.now(),
        type: "data",
      };

      matches.forEach((c) => {
        logger.info(
          `Notifying wallet ${c.subscription.wallet}, currency ${c.subscription.currency}`,
        );
        c.socket.send(JSON.stringify(message));
      });
    });
  }
}
