import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { PrefixedLogger } from "../src/logger";

const LOG_FILE = "log.txt";

vi.mock("tslog", async () => {
  const actual = await vi.importActual<typeof import("tslog")>("tslog");
  return {
    ...actual,
    Logger: vi.fn(
      class {
        minLevel: number;
        constructor({ minLevel = 0 }: { minLevel?: number } = {}) {
          this.minLevel = minLevel;
        }
        debug = vi.fn((...args: string[]) =>
          writeFileSync(LOG_FILE, "DEBUG\n" + args.join("\n"), {
            encoding: "utf-8",
          }),
        );
        info = vi.fn((...args: string[]) =>
          writeFileSync(LOG_FILE, "INFO\n" + args.join("\n"), {
            encoding: "utf-8",
          }),
        );
        error = vi.fn((...args: string[]) =>
          writeFileSync(LOG_FILE, "ERROR\n" + args.join("\n"), {
            encoding: "utf-8",
          }),
        );
        warn = vi.fn((...args: string[]) =>
          writeFileSync(LOG_FILE, "WARN\n" + args.join("\n"), {
            encoding: "utf-8",
          }),
        );
        trace = vi.fn((...args: string[]) =>
          writeFileSync(LOG_FILE, "TRACE\n" + args.join("\n"), {
            encoding: "utf-8",
          }),
        );
        silly = vi.fn((...args: string[]) =>
          writeFileSync(LOG_FILE, "SILLY\n" + args.join("\n"), {
            encoding: "utf-8",
          }),
        );
        fatal = vi.fn((...args: string[]) =>
          writeFileSync(LOG_FILE, "FATAL\n" + args.join("\n"), {
            encoding: "utf-8",
          }),
        );
      },
    ),
  };
});

function readLogs() {
  const content = readFileSync(LOG_FILE, { encoding: "utf8" });
  return content;
}

const MESSAGE = "this is a test";
const PREFIX = "[test]";

beforeEach(() => {
  writeFileSync(LOG_FILE, "", { encoding: "utf-8" });
});

afterAll(() => {
  unlinkSync(LOG_FILE);
});

describe("Test prefixed logger methods", () => {
  it("Test info", () => {
    const logger = new PrefixedLogger(PREFIX);
    logger.info(MESSAGE);
    const logs = readLogs();
    expect(logs).toBe(`INFO\n${PREFIX} ${MESSAGE}`);
  });

  it("Test debug", () => {
    const logger = new PrefixedLogger(PREFIX);
    logger.debug(MESSAGE);
    const logs = readLogs();
    expect(logs).toBe(`DEBUG\n${PREFIX} ${MESSAGE}`);
  });

  it("Test error", () => {
    const logger = new PrefixedLogger(PREFIX);
    logger.error(MESSAGE);
    const logs = readLogs();
    expect(logs).toBe(`ERROR\n${PREFIX} ${MESSAGE}`);
  });

  it("Test warn", () => {
    const logger = new PrefixedLogger(PREFIX);
    logger.warn(MESSAGE);
    const logs = readLogs();
    expect(logs).toBe(`WARN\n${PREFIX} ${MESSAGE}`);
  });

  it("Test trace", () => {
    const logger = new PrefixedLogger(PREFIX);
    logger.trace(MESSAGE);
    const logs = readLogs();
    expect(logs).toBe(`TRACE\n${PREFIX} ${MESSAGE}`);
  });

  it("Test silly", () => {
    const logger = new PrefixedLogger(PREFIX);
    logger.silly(MESSAGE);
    const logs = readLogs();
    expect(logs).toBe(`SILLY\n${PREFIX} ${MESSAGE}`);
  });

  it("Test fatal", () => {
    const logger = new PrefixedLogger(PREFIX);
    logger.fatal(MESSAGE);
    const logs = readLogs();
    expect(logs).toBe(`FATAL\n${PREFIX} ${MESSAGE}`);
  });
});
