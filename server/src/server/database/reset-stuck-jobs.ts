import { envFile } from "../env.config";
import { initPostgresDbClient } from "./postgres-db-client";
import dotenv from "dotenv";
dotenv.config({ path: envFile });

(async () => {
  const dbClient = await initPostgresDbClient();

  await dbClient.query(`
    UPDATE jobs
    SET status = 'pending', data = 'null'
    WHERE status = 'in_progress' OR WHERE status = 'post_processing'
  `);

  console.log("✅ Reset all in_progress and post_processing jobs to pending");
  process.exit(0);
})();
