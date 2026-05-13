import {
  LiteParseConfig,
  ParsedPage,
  ScreenshotResult,
} from "@llamaindex/liteparse";
import { Mutex } from "async-mutex";
import Redis from "ioredis";
import crypto from "crypto";

export class RedisCache {
  private uri: string;
  private password: string;
  private mu: Mutex;
  private client: Redis | undefined = undefined;
  readonly parsePrefix: string = "parse";
  readonly batchParsePrefix: string = "batch_parse";
  readonly screenshotPrefix: string = "screenshot";

  constructor() {
    const key = process.env.REDIS_URI;
    const psw = process.env.REDIS_PASSWORD;
    if (key && psw) {
      this.uri = key;
      this.password = psw;
      this.mu = new Mutex();
    } else {
      throw new Error(
        "Cannot initialize Redis client as REDIS_URI or REDIS_PASSWORD are not available in the current environment",
      );
    }
  }

  private async getClient() {
    const client = await this.mu.runExclusive(async () => {
      if (this.client) {
        return this.client;
      }
      this.client = new Redis(this.uri, {
        enableOfflineQueue: true,
        password: this.password,
      });
      this.client.on("error", (err) => {
        console.error("Redis error:", err);
      });
      return this.client;
    });
    return client;
  }

  async setParsed(
    fileHash: string,
    text: boolean,
    config: Partial<LiteParseConfig> | undefined,
    result: string | ParsedPage[],
  ) {
    const client = await this.getClient();
    const conf = config ? JSON.stringify(config) : "unset";
    await client.setex(
      `${this.parsePrefix}:${text ? "text" : "pages"}:${conf}:${fileHash}`,
      3600, // 1 hour
      typeof result === "string" ? result : JSON.stringify(result),
    );
  }

  async getParsed(
    fileHash: string,
    text: boolean,
    config: Partial<LiteParseConfig> | undefined,
  ) {
    const client = await this.getClient();
    const conf = config ? JSON.stringify(config) : "unset";
    const stored = await client.get(
      `${this.parsePrefix}:${text ? "text" : "pages"}:${conf}:${fileHash}`,
    );
    if (stored) {
      if (text) {
        return stored;
      } else {
        return JSON.parse(stored) as ParsedPage[];
      }
    }
    return null;
  }

  async setBatchParsed(
    filesHash: string,
    text: boolean,
    config: Partial<LiteParseConfig> | undefined,
    result:
      | { file_name: string; text: string }[]
      | { file_name: string; pages: ParsedPage[] }[],
  ) {
    const client = await this.getClient();
    const conf = config ? JSON.stringify(config) : "unset";
    await client.setex(
      `${this.batchParsePrefix}:${text ? "text" : "pages"}:${conf}:${filesHash}`,
      3600 * 12, // 12 hours
      JSON.stringify(result),
    );
  }

  async getBatchParsed(
    filesHash: string,
    text: boolean,
    config: Partial<LiteParseConfig> | undefined,
  ) {
    const client = await this.getClient();
    const conf = config ? JSON.stringify(config) : "unset";
    const stored = await client.get(
      `${this.batchParsePrefix}:${text ? "text" : "pages"}:${conf}:${filesHash}`,
    );
    if (stored) {
      if (text) {
        return JSON.parse(stored) as { file_name: string; text: string }[];
      } else {
        return JSON.parse(stored) as {
          file_name: string;
          pages: ParsedPage[];
        }[];
      }
    }
    return null;
  }

  async setScreenshot(
    fileHash: string,
    pages: string | undefined,
    config: Partial<LiteParseConfig> | undefined,
    result: ScreenshotResult[],
  ) {
    const client = await this.getClient();
    const conf = config ? JSON.stringify(config) : "unset";
    await client.setex(
      `${this.screenshotPrefix}:${pages ? pages : "all"}:${conf}:${fileHash}`,
      24 * 3600, // 24 hours
      JSON.stringify(result),
    );
  }

  async getScreenshot(
    fileHash: string,
    pages: string | undefined,
    config: Partial<LiteParseConfig> | undefined,
  ) {
    const client = await this.getClient();
    const conf = config ? JSON.stringify(config) : "unset";
    const stored = await client.get(
      `${this.screenshotPrefix}:${pages ? pages : "all"}:${conf}:${fileHash}`,
    );
    if (stored) {
      return JSON.parse(stored) as ScreenshotResult[];
    }
    return null;
  }
}

export function getFileHash(file: Express.Multer.File) {
  return crypto.createHash("sha256").update(file.buffer).digest("hex");
}

let cache: RedisCache | undefined = undefined;

export function getCache() {
  if (!cache) {
    cache = new RedisCache();
  }
  return cache;
}
