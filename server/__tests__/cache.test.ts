import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { RedisCache } from "../src/cache";
import {
  LiteParseConfig,
  ParsedPage,
  ScreenshotResult,
} from "@llamaindex/liteparse";

vi.mock("ioredis", async () => {
  return {
    default: vi.fn(
      class {
        path: string;
        private data: Map<
          string,
          { ttl: number; value: string; timestamp: number }
        >;

        constructor(
          path: string,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _options: { enableOfflineQueue: boolean; password: string },
        ) {
          this.path = path;
          this.data = new Map();
        }
        setex = vi.fn(async (key: string, seconds: number, value: string) => {
          this.data.set(key, { ttl: seconds, value, timestamp: Date.now() });
        });
        get = vi.fn(async (key: string) => {
          const v = this.data.get(key);
          if (!v) return null;
          if (Date.now() - v.timestamp > v.ttl * 1000) return null;
          return v.value;
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        on = vi.fn((_event: string, _callback: (err: unknown) => void) => {});
      },
    ),
  };
});

const HASH = "fake_hash";
const PARSED_PAGES: ParsedPage[] = [
  { pageNum: 1, text: "hello", textItems: [], width: 100, height: 200 },
  { pageNum: 2, text: "bye", textItems: [], width: 150, height: 250 },
  { pageNum: 3, text: "salut", textItems: [], width: 130, height: 180 },
];
const PARSED_TEXT = "hello\nbye\nsalut";
const BATCH_PAGES: { file_name: string; pages: ParsedPage[] }[] = [
  { file_name: "test.pdf", pages: PARSED_PAGES },
  { file_name: "test_1.pdf", pages: PARSED_PAGES.slice(1) },
];
const BATCH_TEXT: { file_name: string; text: string }[] = [
  { file_name: "test.pdf", text: PARSED_TEXT },
  { file_name: "test_1.pdf", text: PARSED_TEXT.replace("hello\n", "") },
];
const SCREENSHOTS: ScreenshotResult[] = [
  { imageBuffer: Buffer.from([0, 1, 2]), pageNum: 1, width: 100, height: 200 },
  { imageBuffer: Buffer.from([3, 4, 5]), pageNum: 2, width: 150, height: 250 },
  { imageBuffer: Buffer.from([6, 7, 8]), pageNum: 3, width: 130, height: 180 },
];

const originalUri = process.env.REDIS_URI;
const originalPassword = process.env.REDIS_PASSWORD;

beforeEach(() => {
  process.env.REDIS_URI = "redis://localhost:6379";
  process.env.REDIS_PASSWORD = "secret"; // this is not a real password
});

afterEach(() => {
  if (originalUri === undefined) {
    delete process.env.REDIS_URI;
  } else {
    process.env.REDIS_URI = originalUri;
  }
  if (originalPassword === undefined) {
    delete process.env.REDIS_PASSWORD;
  } else {
    process.env.REDIS_PASSWORD = originalPassword;
  }
});

describe("Test caching for parsed content", () => {
  it("Test with pages, no config", async () => {
    const cache = new RedisCache();
    await cache.setParsed(HASH, false, undefined, PARSED_PAGES);
    const parsed = await cache.getParsed(HASH, false, undefined);
    expect(parsed).toBeTruthy();
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toStrictEqual(PARSED_PAGES);
    const noText = await cache.getParsed(HASH, true, undefined);
    expect(noText).toBeNull();
    const noConf = await cache.getParsed(HASH, false, { dpi: 180 });
    expect(noConf).toBeNull();
    // demonstrate that there is no leaking from parsed to batch-parsed
    const noBatchParsed = await cache.getBatchParsed(HASH, false, undefined);
    expect(noBatchParsed).toBeNull();
  });

  it("Test with pages, w/config", async () => {
    const cache = new RedisCache();
    const config: Partial<LiteParseConfig> = { targetPages: "1", dpi: 180 };
    await cache.setParsed(HASH, false, config, PARSED_PAGES);
    const parsed = await cache.getParsed(HASH, false, config);
    expect(parsed).toBeTruthy();
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toStrictEqual(PARSED_PAGES);
    const noText = await cache.getParsed(HASH, true, undefined);
    expect(noText).toBeNull();
    const diffConf = await cache.getParsed(HASH, false, { dpi: 180 });
    expect(diffConf).toBeNull();
    const noConf = await cache.getParsed(HASH, false, undefined);
    expect(noConf).toBeNull();
    // demonstrate that there is no leaking from parsed to batch-parsed
    const noBatchParsed = await cache.getBatchParsed(HASH, false, config);
    expect(noBatchParsed).toBeNull();
  });

  it("Test with text, no config", async () => {
    const cache = new RedisCache();
    await cache.setParsed(HASH, true, undefined, PARSED_TEXT);
    const parsed = await cache.getParsed(HASH, true, undefined);
    expect(parsed).toBeTruthy();
    expect(typeof parsed === "string").toBe(true);
    expect(parsed).toBe(PARSED_TEXT);
    const noText = await cache.getParsed(HASH, false, undefined);
    expect(noText).toBeNull();
    const noConf = await cache.getParsed(HASH, true, { dpi: 180 });
    expect(noConf).toBeNull();
    // demonstrate that there is no leaking from parsed to batch-parsed
    const noBatchParsed = await cache.getBatchParsed(HASH, true, undefined);
    expect(noBatchParsed).toBeNull();
  });

  it("Test with text, w/config", async () => {
    const cache = new RedisCache();
    const config: Partial<LiteParseConfig> = { targetPages: "1", dpi: 180 };
    await cache.setParsed(HASH, true, config, PARSED_TEXT);
    const parsed = await cache.getParsed(HASH, true, config);
    expect(parsed).toBeTruthy();
    expect(typeof parsed === "string").toBe(true);
    expect(parsed).toBe(PARSED_TEXT);
    const noText = await cache.getParsed(HASH, false, undefined);
    expect(noText).toBeNull();
    const diffConf = await cache.getParsed(HASH, true, { dpi: 180 });
    expect(diffConf).toBeNull();
    const noConf = await cache.getParsed(HASH, true, undefined);
    expect(noConf).toBeNull();
    // demonstrate that there is no leaking from parsed to batch-parsed
    const noBatchParsed = await cache.getBatchParsed(HASH, true, config);
    expect(noBatchParsed).toBeNull();
  });
});

describe("Test caching for batch-parsed content", () => {
  it("Test with pages, no config", async () => {
    const cache = new RedisCache();
    await cache.setBatchParsed(HASH, false, undefined, BATCH_PAGES);
    const parsed = await cache.getBatchParsed(HASH, false, undefined);
    expect(parsed).toBeTruthy();
    expect(parsed).toStrictEqual(BATCH_PAGES);
    const noText = await cache.getBatchParsed(HASH, true, undefined);
    expect(noText).toBeNull();
    const noConf = await cache.getBatchParsed(HASH, false, { dpi: 180 });
    expect(noConf).toBeNull();
    // demonstrate that there is no leaking from batch-parsed to parsed
    const noParsed = await cache.getParsed(HASH, false, undefined);
    expect(noParsed).toBeNull();
  });

  it("Test with pages, w/config", async () => {
    const cache = new RedisCache();
    const config: Partial<LiteParseConfig> = { targetPages: "1", dpi: 180 };
    await cache.setBatchParsed(HASH, false, config, BATCH_PAGES);
    const parsed = await cache.getBatchParsed(HASH, false, config);
    expect(parsed).toBeTruthy();
    expect(parsed).toStrictEqual(BATCH_PAGES);
    const noText = await cache.getBatchParsed(HASH, true, undefined);
    expect(noText).toBeNull();
    const diffConf = await cache.getBatchParsed(HASH, false, { dpi: 180 });
    expect(diffConf).toBeNull();
    const noConf = await cache.getBatchParsed(HASH, false, undefined);
    expect(noConf).toBeNull();
    // demonstrate that there is no leaking from batch-parsed toparsed
    const noParsed = await cache.getParsed(HASH, false, config);
    expect(noParsed).toBeNull();
  });

  it("Test with text, no config", async () => {
    const cache = new RedisCache();
    await cache.setBatchParsed(HASH, true, undefined, BATCH_TEXT);
    const parsed = await cache.getBatchParsed(HASH, true, undefined);
    expect(parsed).toBeTruthy();
    expect(parsed).toStrictEqual(BATCH_TEXT);
    const noText = await cache.getBatchParsed(HASH, false, undefined);
    expect(noText).toBeNull();
    const noConf = await cache.getBatchParsed(HASH, true, { dpi: 180 });
    expect(noConf).toBeNull();
    // demonstrate that there is no leaking from batch-parsed to parsed
    const noParsed = await cache.getParsed(HASH, true, undefined);
    expect(noParsed).toBeNull();
  });

  it("Test with text, w/config", async () => {
    const cache = new RedisCache();
    const config: Partial<LiteParseConfig> = { targetPages: "1", dpi: 180 };
    await cache.setBatchParsed(HASH, true, config, BATCH_TEXT);
    const parsed = await cache.getBatchParsed(HASH, true, config);
    expect(parsed).toBeTruthy();
    expect(parsed).toStrictEqual(BATCH_TEXT);
    const noText = await cache.getBatchParsed(HASH, false, undefined);
    expect(noText).toBeNull();
    const diffConf = await cache.getBatchParsed(HASH, true, { dpi: 180 });
    expect(diffConf).toBeNull();
    const noConf = await cache.getBatchParsed(HASH, true, undefined);
    expect(noConf).toBeNull();
    // demonstrate that there is no leaking from parsed to batch-parsed
    const noParsed = await cache.getParsed(HASH, true, config);
    expect(noParsed).toBeNull();
  });
});

describe("Test caching for screenshots", () => {
  it("Test with all pages, no config", async () => {
    const cache = new RedisCache();
    await cache.setScreenshot(HASH, undefined, undefined, SCREENSHOTS);
    const result = await cache.getScreenshot(HASH, undefined, undefined);
    expect(result).toBeTruthy();
    expect(
      result!.map((r) => ({
        ...r,
        imageBuffer: Buffer.from(r.imageBuffer),
      })),
    ).toStrictEqual(SCREENSHOTS);
    const noConf = await cache.getScreenshot(HASH, undefined, { dpi: 180 });
    expect(noConf).toBeNull();
    const noPages = await cache.getScreenshot(HASH, "1,2", undefined);
    expect(noPages).toBeNull();
  });

  it("Test with all pages, w/config", async () => {
    const cache = new RedisCache();
    const config: Partial<LiteParseConfig> = { targetPages: "1" };
    await cache.setScreenshot(HASH, undefined, config, SCREENSHOTS);
    const result = await cache.getScreenshot(HASH, undefined, config);
    expect(result).toBeTruthy();
    expect(
      result!.map((r) => ({
        ...r,
        imageBuffer: Buffer.from(r.imageBuffer),
      })),
    ).toStrictEqual(SCREENSHOTS);
    const diffConf = await cache.getScreenshot(HASH, undefined, { dpi: 180 });
    expect(diffConf).toBeNull();
    const noConf = await cache.getScreenshot(HASH, undefined, undefined);
    expect(noConf).toBeNull();
    const noPages = await cache.getScreenshot(HASH, "1,2", config);
    expect(noPages).toBeNull();
  });

  it("Test with selected pages, no config", async () => {
    const cache = new RedisCache();
    await cache.setScreenshot(HASH, "1,2", undefined, SCREENSHOTS.slice(0, 2));
    const result = await cache.getScreenshot(HASH, "1,2", undefined);
    expect(result).toBeTruthy();
    expect(
      result!.map((r) => ({
        ...r,
        imageBuffer: Buffer.from(r.imageBuffer),
      })),
    ).toStrictEqual(SCREENSHOTS.slice(0, 2));
    const noConf = await cache.getScreenshot(HASH, "1,2", { dpi: 180 });
    expect(noConf).toBeNull();
    const noPages = await cache.getScreenshot(HASH, undefined, undefined);
    expect(noPages).toBeNull();
  });

  it("Test with selected pages, w/config", async () => {
    const cache = new RedisCache();
    const config: Partial<LiteParseConfig> = { targetPages: "1" };
    await cache.setScreenshot(HASH, "1,2", config, SCREENSHOTS.slice(0, 2));
    const result = await cache.getScreenshot(HASH, "1,2", config);
    expect(result).toBeTruthy();
    expect(
      result!.map((r) => ({
        ...r,
        imageBuffer: Buffer.from(r.imageBuffer),
      })),
    ).toStrictEqual(SCREENSHOTS.slice(0, 2));
    const diffConf = await cache.getScreenshot(HASH, "1,2", { dpi: 180 });
    expect(diffConf).toBeNull();
    const noConf = await cache.getScreenshot(HASH, "1,2", undefined);
    expect(noConf).toBeNull();
    const noPages = await cache.getScreenshot(HASH, undefined, config);
    expect(noPages).toBeNull();
  });
});
