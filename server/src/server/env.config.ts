import path from "path";

export const envFile = path.normalize(
  __dirname + "/../../" + (process.env["ENV_FILE"] || ".env"),
);
