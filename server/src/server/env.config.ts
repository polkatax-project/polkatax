import path from "path";

export const envFile = path.normalize(
  process.cwd() + "/" + (process.env["ENV_FILE"] || ".env"),
);
