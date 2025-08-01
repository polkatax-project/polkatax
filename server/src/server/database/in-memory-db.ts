import { Client } from "pg";
import { newDb } from "pg-mem";

const createDb = async (client: Client) => {
  await (client as any).none(`CREATE TABLE IF NOT EXISTS jobs (
    status TEXT,
    wallet TEXT,
    blockchain TEXT,
    last_modified TIMESTAMPTZ,
    data JSONB,
    error JSONB,
    sync_from_date TIMESTAMPTZ,
    currency TEXT,
    synced_until TIMESTAMPTZ,
    req_id TEXT
    );`);
  await (client as any).none(`CREATE TABLE fetched_data (
    key TEXT PRIMARY KEY, 
    data JSONB,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ)`);
};

function parseNotifyCommand(input: string): {
  channel: string;
  rawPayload: any | null;
} {
  const trimmed = input.trim();

  // Match: NOTIFY channel;  or  NOTIFY channel, 'payload';
  const regex = /^NOTIFY\s+([\w\-]+)(?:,\s*'([^']*)')?;$/;

  const match = trimmed.match(regex);
  if (!match) {
    throw new Error("Invalid NOTIFY syntax");
  }

  const [, channel, rawPayload] = match;
  return { channel, rawPayload };
}

export const initInMemoryDb = async (): Promise<Client> => {
  const db = newDb();
  const client = db.adapters.createPgPromise();
  await createDb(client);
  /**
   * notify does not work using pg-mem. Hence a wrapper is needed for local testing.
   */
  const clientWithNotify = {
    ...client,
    query: async (queryString: string, values: any[]) => {
      queryString = queryString.trim();
      if (queryString.startsWith("NOTIFY")) {
        const { channel, rawPayload } = parseNotifyCommand(queryString);
        clientWithNotify.notificationSubscriptions.forEach((cb) => {
          cb({ channel, payload: rawPayload || "{}" });
        });
      } else if (queryString.startsWith("LISTEN")) {
        // pass
      } else {
        return { rows: await client.query(queryString, values) };
      }
    },
    on: (_event: string, cb: any) => {
      clientWithNotify.notificationSubscriptions.push(cb);
    },
    notificationSubscriptions: [],
  };
  return clientWithNotify;
};
