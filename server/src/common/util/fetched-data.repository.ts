import { connectToDb } from "../../server/database/db-connection";
import crypto from "crypto";
import { logger } from "../../server/logger/logger";

export class FetchedDataRepository {
  get getDatabaseClient() {
    return connectToDb();
  }

  async fetchStoredData<T>(
    path: string,
    method: string,
    body?: any,
  ): Promise<T | undefined> {
    const key = this.generateCacheKey(path, method, body);
    const cached = await (
      await this.getDatabaseClient
    ).query(
      `SELECT data FROM fetched_data WHERE key = $1 AND expires_at > NOW()`,
      [key],
    );
    if (cached?.rows?.length > 0) {
      return cached.rows[0].data;
    }
    return undefined;
  }

  async storeFetchedResult(
    path: string,
    method: string,
    body: any,
    result: any,
    cacheDurationInHours = 6,
  ) {
    const key = this.generateCacheKey(path, method, body);
    const cacheDuration = cacheDurationInHours + " hours";

    await (
      await this.getDatabaseClient
    ).query(
      "INSERT INTO fetched_data (key, data, created_at, expires_at) VALUES ($1, $2, NOW(), NOW() + $3::interval) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, expires_at = NOW() + $3::interval;",
      [key, result, cacheDuration],
    );
    logger.debug(
      "data stored for " +
        path +
        ", " +
        JSON.stringify(body) +
        " with key " +
        key,
    );
    return result;
  }

  public generateCacheKey(path: string, method: string, body?: any): string {
    const input = JSON.stringify({ path, method, body });
    return crypto.createHash("md5").update(input).digest("hex");
  }
}
