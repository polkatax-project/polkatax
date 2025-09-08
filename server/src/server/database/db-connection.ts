import { Client } from "pg";
import { initPostgresDbClient } from "./postgres-db-client";
import { initInMemoryDb } from "./in-memory-db";

let client: Client | undefined = undefined;

export const connectToDb = async (): Promise<Client> => {
  if (client) {
    return client;
  }
  client =
    process.env["POSTGRES_DATABASE"] === "true"
      ? await initPostgresDbClient()
      : await initInMemoryDb();
  return client;
};
