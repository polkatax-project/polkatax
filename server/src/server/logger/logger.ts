import { createLogger } from "../../common/logger/logger-factory";

export const logger = createLogger(process.env["LOG_FILE_NAME"] ?? "app");
