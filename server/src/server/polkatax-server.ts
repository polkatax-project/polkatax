import Fastify from "fastify";
import path from "path";
import { logger } from "./logger/logger";
import dotenv from "dotenv";
import websocketPlugin from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
dotenv.config({ path: __dirname + "/../../.env" });

import * as fs from "fs";
import { HttpError } from "../common/error/HttpError";
import { DIContainer } from "./di-container";
import { WebSocketManager } from "./endpoints/websocket.manager";

export const polkataxServer = {
  init: async () => {
    const fastify = Fastify({
      loggerInstance: logger,
    });
    await fastify.register(websocketPlugin);
    await fastify.register(rateLimit, { global: false });

    const staticFilesFolder = path.join(__dirname, "../../public");
    if (fs.existsSync(staticFilesFolder)) {
      fastify.log.info(
        "Static files are served from folder " + staticFilesFolder,
      );
      await fastify.register(import("@fastify/static"), {
        root: staticFilesFolder,
      });
    }

    fastify.get("/api/res/subscan-chains", function (req, reply) {
      return fs.readFileSync(
        path.join(__dirname, "../../res/gen/subscan-chains.json"),
        "utf-8",
      );
    });

    fastify.setErrorHandler((error, request, reply) => {
      if (error.statusCode) {
        logger.error(
          `Error: Status ${error.statusCode}, Message: ${error.message}${(error as HttpError)?.requestUrl ? ", Request Url: " + (error as HttpError)?.requestUrl : ""}`,
          error,
        );
        reply.status(error.statusCode).send(error.message);
      } else {
        logger.warn(`Error: ${error.message}`, error);
        if (error.stack) {
          logger.error(error.stack);
        }
        reply.status(500).send(error.message);
      }
    });

    fastify.setNotFoundHandler((request, reply) => {
      // TODO: implement better solution
      reply.header("Content-Type", "text/html");
      reply
        .send(fs.readFileSync(staticFilesFolder + "/index.html", "utf-8"))
        .status(200);
    });

    const webSocketManager: WebSocketManager = DIContainer.resolve(
          "webSocketManager",
    )
    fastify.get('/ws', { websocket: true }, webSocketManager.wsHandler)
    webSocketManager.startJobNotificationChannel();

    fastify.listen(
      { port: Number(process.env["PORT"] || 3001), host: "0.0.0.0" },
      (err) => {
        if (err) {
          fastify.log.error(err);
          process.exit(1);
        }
      },
    );
    return fastify;
  },
};
