import { Client } from "pg";

export const initPostgresDbClient = async (): Promise<Client> => {
  const client = new Client({
    user: "polkatax",
    host: process.env["DB_HOST"] || "localhost",
    database: "polkatax_fe",
    password: process.env["DB_PASSWORD"],
    port: 5432,
  });
  await client.connect();
  return client;
};
