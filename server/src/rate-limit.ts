import { Redis } from "ioredis";
import { Mutex } from "async-mutex";
import { RateLimiterRedis } from "rate-limiter-flexible";

const RATE_LIMIT_PREFIX = "liteparse-server:ratelimit";

class RateLimiterFactory {
  private client: Redis | undefined = undefined;
  private uri: string;
  private password: string;
  private clientMu: Mutex;
  private limiterMu: Mutex;
  private limiter: RateLimiterRedis | undefined = undefined;

  constructor() {
    const key = process.env.REDIS_URI;
    const psw = process.env.REDIS_PASSWORD;
    if (key && psw) {
      this.uri = key;
      this.password = psw;
      this.clientMu = new Mutex();
      this.limiterMu = new Mutex();
    } else {
      throw new Error(
        "Cannot initialize Redis client as REDIS_URI or REDIS_PASSWORD are not available in the current environment",
      );
    }
  }

  private async getClient() {
    const client = await this.clientMu.runExclusive(async () => {
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

  async getLimiter() {
    return await this.limiterMu.runExclusive(async () => {
      if (this.limiter) return this.limiter;

      const client = await this.getClient();
      this.limiter = new RateLimiterRedis({
        storeClient: client,
        keyPrefix: RATE_LIMIT_PREFIX,
        points: 100,
        duration: 60,
      });
      return this.limiter;
    });
  }
}

let rlFactory: RateLimiterFactory | undefined = undefined;

export function getRLFactory() {
  if (rlFactory) {
    return rlFactory;
  }
  rlFactory = new RateLimiterFactory();
  return rlFactory;
}
