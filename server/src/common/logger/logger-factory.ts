import path from "path";
import pino from "pino";

export const createLogger = (fileName: string) => {
  const transport =
    process.env["NODE_ENV"] === "test"
      ? undefined
      : pino.transport({
          targets: [
            {
              level: "info",
              target: "pino/file",
              options: {
                destination: path.join(
                  process.cwd(),
                  "logs",
                  fileName + ".log",
                ),
              },
            },
            {
              level: process.env.LOG_LEVEL || "info",
              target: "pino-pretty",
              options: {},
            },
          ],
        });

  return pino(
    {
      base: undefined,
      timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
    },
    transport,
  );
};
