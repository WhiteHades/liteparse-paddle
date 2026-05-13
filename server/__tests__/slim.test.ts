import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../src/slim";
import { LiteParseConfig, ParsedPage } from "@llamaindex/liteparse";

const PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_1 = "AlphaFlex Packaging Group";
const PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_2 = "Veridian Health Technologies";
const LITEPARSE_CONFIG_TARGET: Partial<LiteParseConfig> = { targetPages: "1" };
const LITEPARSE_CONFIG_SCREEN: Partial<LiteParseConfig> = { dpi: 180 };

describe("POST /parse", () => {
  it("/parse: text, no config", async () => {
    const res = await request(app)
      .post("/parse")
      .query({ text: "true" })
      .attach("file", "./data/pe_deal_examples.pdf")
      .expect(200);
    const text = res.text;
    expect(text.length).toBeGreaterThan(1);
    expect(text.includes(PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_1)).toBe(true);
    expect(text.includes(PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_2)).toBe(true);
    const contentType = res.headers["content-type"];
    expect(contentType).toBeDefined();
    expect(contentType!.includes("text/plain")).toBe(true);
  });

  it("/parse: text, w/config", async () => {
    const res = await request(app)
      .post("/parse")
      .query({ text: "true" })
      .field("config", JSON.stringify(LITEPARSE_CONFIG_TARGET))
      .attach("file", "./data/pe_deal_examples.pdf")
      .expect(200);
    const text = res.text;
    expect(text.length).toBeGreaterThan(1);
    expect(text.includes(PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_1)).toBe(true);
    expect(text.includes(PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_2)).toBe(false); // only page 1 included
    const contentType = res.headers["content-type"];
    expect(contentType).toBeDefined();
    expect(contentType!.includes("text/plain")).toBe(true);
  });

  it("/parse: pages, no config", async () => {
    const res = await request(app)
      .post("/parse")
      .attach("file", "./data/pe_deal_examples.pdf")
      .expect(200);
    let pages: { pages: ParsedPage[] };
    if (typeof res.body === "string") {
      pages = JSON.parse(res.body);
    } else {
      pages = res.body;
    }
    expect(pages.pages.length).toBe(2);
    expect(
      pages.pages[0]?.text.includes(PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_1),
    ).toBe(true);
    expect(
      pages.pages[1]?.text.includes(PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_2),
    ).toBe(true);
    const contentType = res.headers["content-type"];
    expect(contentType).toBeDefined();
    expect(contentType!.includes("application/json")).toBe(true);
  });

  it("/parse: pages, w/config", async () => {
    const res = await request(app)
      .post("/parse")
      .field("config", JSON.stringify(LITEPARSE_CONFIG_TARGET))
      .attach("file", "./data/pe_deal_examples.pdf")
      .expect(200);
    let pages: { pages: ParsedPage[] };
    if (typeof res.body === "string") {
      pages = JSON.parse(res.body);
    } else {
      pages = res.body;
    }
    expect(pages.pages.length).toBe(1);
    expect(
      pages.pages[0]?.text.includes(PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_1),
    ).toBe(true);
    expect(
      pages.pages[0]?.text.includes(PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_2),
    ).toBe(false); // only first page included
    const contentType = res.headers["content-type"];
    expect(contentType).toBeDefined();
    expect(contentType!.includes("application/json")).toBe(true);
  });

  it("/parse: bad field", async () => {
    const res = await request(app)
      .post("/parse")
      .field("fil", "./data/pe_deal_examples.pdf")
      .expect(400);
    const body = res.body;
    if (typeof body === "string") {
      expect(
        body.includes("You need to provide a file in the `file` field"),
      ).toBe(true);
    } else {
      const b = body as { detail: string };
      expect(b.detail).toBe("You need to provide a file in the `file` field");
    }
  });
});

type ScreenshotPayload = {
  index: number;
  mimetype: string;
  data: string;
  page_number: number;
  height: number;
  width: number;
};

function parseNdjson(text: string): ScreenshotPayload[] {
  return text
    .trim()
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as ScreenshotPayload);
}

describe("POST /screenshots", () => {
  it("/screenshots: no pages, no config", async () => {
    const res = await request(app)
      .post("/screenshots")
      .attach("file", "./data/pe_deal_examples.pdf")
      .expect(200);
    const contentType = res.headers["content-type"];
    expect(contentType).toBeDefined();
    expect(contentType!.includes("application/x-ndjson")).toBe(true);
    const screenshots = parseNdjson(res.text);
    expect(screenshots.length).toBe(2); // pe_deal_examples.pdf has 2 pages
    for (let i = 0; i < screenshots.length; i++) {
      const s = screenshots[i]!;
      expect(s.index).toBe(i);
      expect(s.mimetype).toBe("image/png");
      expect(s.data.length).toBeGreaterThan(0);
      expect(typeof s.page_number).toBe("number");
      expect(s.height).toBeGreaterThan(0);
      expect(s.width).toBeGreaterThan(0);
    }
  });

  it("/screenshots: with pages, no config", async () => {
    const res = await request(app)
      .post("/screenshots")
      .query({ pages: "1" })
      .attach("file", "./data/pe_deal_examples.pdf")
      .expect(200);
    const contentType = res.headers["content-type"];
    expect(contentType).toBeDefined();
    expect(contentType!.includes("application/x-ndjson")).toBe(true);
    const screenshots = parseNdjson(res.text);
    expect(screenshots.length).toBe(1);
    const s = screenshots[0]!;
    expect(s.index).toBe(0);
    expect(s.mimetype).toBe("image/png");
    expect(s.data.length).toBeGreaterThan(0);
    expect(s.height).toBeGreaterThan(0);
    expect(s.width).toBeGreaterThan(0);
  });

  it("/screenshots: no pages, w/config", async () => {
    const res = await request(app)
      .post("/screenshots")
      .field("config", JSON.stringify(LITEPARSE_CONFIG_SCREEN))
      .attach("file", "./data/pe_deal_examples.pdf")
      .expect(200);
    const contentType = res.headers["content-type"];
    expect(contentType).toBeDefined();
    expect(contentType!.includes("application/x-ndjson")).toBe(true);
    const screenshots = parseNdjson(res.text);
    expect(screenshots.length).toBe(2);
    for (let i = 0; i < screenshots.length; i++) {
      const s = screenshots[i]!;
      expect(s.index).toBe(i);
      expect(s.mimetype).toBe("image/png");
      expect(s.data.length).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
      expect(s.width).toBeGreaterThan(0);
    }
  });

  it("/screenshots: bad field", async () => {
    const res = await request(app)
      .post("/screenshots")
      .field("fil", "./data/pe_deal_examples.pdf")
      .expect(400);
    const body = res.body;
    if (typeof body === "string") {
      expect(
        body.includes("You need to provide a file in the `file` field"),
      ).toBe(true);
    } else {
      const b = body as { detail: string };
      expect(b.detail).toBe("You need to provide a file in the `file` field");
    }
  });
});
