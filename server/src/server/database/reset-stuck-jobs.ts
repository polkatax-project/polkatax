import { envFile } from "../env.config";
import { initPostgresDbClient } from "./postgres-db-client";
import dotenv from "dotenv";
dotenv.config({ path: envFile });

(async () => {
  const dbClient = await initPostgresDbClient();

  await dbClient.query(`
    UPDATE jobs
    SET status = 'pending'
    WHERE status = 'in_progress'
  `);

  console.log("✅ Reset all in_progress jobs to pending");
  process.exit(0);
})();
