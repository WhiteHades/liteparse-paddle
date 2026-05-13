import { trace, metrics } from "@opentelemetry/api";

export const tracer = trace.getTracer("liteparse-server", "0.1.0");

const meter = metrics.getMeter("liteparse-server", "0.1.0");

// --- Parse metrics ---

/** Time to parse a single file, in milliseconds. */
export const parseDurationMs = meter.createHistogram(
  "liteparse.parse.duration_ms",
  { description: "Time to parse a single file", unit: "ms" },
);

/** Size of each file submitted for parsing, in bytes. */
export const parseFileSizeBytes = meter.createHistogram(
  "liteparse.parse.file_size_bytes",
  { description: "Size of files submitted for parsing", unit: "By" },
);

/** Number of pages in each successfully parsed file. */
export const parsePagesCount = meter.createHistogram(
  "liteparse.parse.pages_count",
  { description: "Number of pages in a parsed file" },
);

/** Total number of files parsed (incremented per file). */
export const parseFilesTotal = meter.createCounter(
  "liteparse.parse.files_total",
  { description: "Total number of files parsed" },
);

/** Total number of parse errors. */
export const parseErrorsTotal = meter.createCounter(
  "liteparse.parse.errors_total",
  { description: "Total number of parse errors" },
);

// --- Screenshot metrics ---

/** Time to parse a single file, in milliseconds. */
export const screenDurationMs = meter.createHistogram(
  "liteparse.screenshot.duration_ms",
  { description: "Time to parse a single file", unit: "ms" },
);

/** Size of each file submitted for parsing, in bytes. */
export const screenFileSizeBytes = meter.createHistogram(
  "liteparse.screenshot.file_size_bytes",
  { description: "Size of files submitted for screenshotting", unit: "By" },
);

/** Number of pages in each successfully parsed file. */
export const screenPagesCount = meter.createHistogram(
  "liteparse.screenshot.pages_count",
  { description: "Number of screenshotted pages in a file" },
);

/** Total number of files parsed (incremented per file). */
export const screenFilesTotal = meter.createCounter(
  "liteparse.screenshot.files_total",
  { description: "Total number of files screenshotted" },
);

/** Total number of parse errors. */
export const screenErrorsTotal = meter.createCounter(
  "liteparse.screenshot.errors_total",
  { description: "Total number of screenshot errors" },
);

// --- HTTP metrics ---

/** Total HTTP requests, labelled by route and response status. */
export const httpRequestsTotal = meter.createCounter(
  "liteparse.http.requests_total",
  { description: "Total HTTP requests" },
);

/** HTTP request duration in milliseconds, labelled by route and status. */
export const httpDurationMs = meter.createHistogram(
  "liteparse.http.duration_ms",
  { description: "HTTP request duration", unit: "ms" },
);

/** Total number of requests rejected by the rate limiter. */
export const httpRateLimitedTotal = meter.createCounter(
  "liteparse.http.rate_limited_total",
  { description: "Total number of rate-limited HTTP requests" },
);

// Cache metrics

/** Total number of cache hits for parse workloads (incremented per hit). */
export const cacheParseHitsTotal = meter.createCounter(
  "liteparse.parse.cache_hits",
  { description: "Total number of cache hits for parse" },
);

/** Total number of cache hits for parse workloads (incremented per hit). */
export const cacheScreenshotHitsTotal = meter.createCounter(
  "liteparse.screenshot.cache_hits",
  { description: "Total number of cache hits for screenshot" },
);
