import { HttpError } from "../error/HttpError";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { logger } from "../../server/logger/logger";

/*export class RequestHelper {
  defaultHeader = {};

  async req(url, method, body?): Promise<any> {
    const response = await this.handleError(
      fetch(url, {
        method: method,
        headers: this.defaultHeader,
        body: body ? JSON.stringify(body) : undefined,
      }), body ? JSON.stringify(body) : ''
    );
    return response.json();
  }

  async handleError(fetchRequest: Promise<any>, body: string) {
    const response = await fetchRequest;
    if (!response.ok) {
      throw new HttpError(response.status, await response.text(), response.url + " - " + body);
    }
    return response;
  }
}*/

/**
 * Used temporarily because it allows for better testing when reponses are caches in the fs.
 */
export class RequestHelper {
  defaultHeader = {};
  private cacheDir = path.resolve("test-cache");
  private useCache = true;
  private recordIfMissing = true;

  constructor(options?: {
    cacheDir?: string;
    useCache?: boolean;
    recordIfMissing?: boolean;
  }) {
    if (options?.cacheDir) this.cacheDir = options.cacheDir;
    if (options?.useCache !== undefined) this.useCache = options.useCache;
    if (options?.recordIfMissing !== undefined)
      this.recordIfMissing = options.recordIfMissing;

    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  async req(url: string, method: string, body?: any): Promise<any> {
    const cacheKey = this.generateCacheKey(url, method, body);
    const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);

    if (this.useCache && fs.existsSync(cacheFile)) {
      return JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
    }

    const response = await this.handleError(
      fetch(url, {
        method: method,
        headers: this.defaultHeader,
        body: body ? JSON.stringify(body) : undefined,
      }),
      body ? JSON.stringify(body) : "",
    );

    const data = await response.json();

    if (this.recordIfMissing) {
      if (fs.existsSync(cacheFile)) {
        logger.warn(
          "Overriding cached file " +
            cacheFile +
            "!  " +
            url +
            " - " +
            JSON.stringify(body),
        );
      }
      fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
    }

    return data;
  }

  async handleError(fetchRequest: Promise<any>, body: string) {
    const response = await fetchRequest;
    if (!response.ok) {
      throw new HttpError(
        response.status,
        await response.text(),
        response.url + " - " + body,
      );
    }
    return response;
  }

  private generateCacheKey(url: string, method: string, body?: any): string {
    const input = JSON.stringify({ url, method, body });
    return crypto.createHash("md5").update(input).digest("hex");
  }
}
