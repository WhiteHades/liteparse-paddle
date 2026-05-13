import { describe, it, expect } from "vitest";
import { parse, screenshot } from "../src/utils";
import { readFile } from "fs/promises";
import path from "path";
import Stream from "stream";
import { LiteParseConfig, ParsedPage } from "@llamaindex/liteparse";

const PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_1 = "AlphaFlex Packaging Group";
const PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_2 = "Veridian Health Technologies";
const RECEIPT_EXPECTED_PART_CONTENT = "Article Count Amount Tax";
const SAMPLE_DOCX_EXPECTED_PART_CONTENT_1 =
  "This document was created using accessibility techniques for headings, lists, image alternate text, tables,";
const SAMPLE_DOCX_EXPECTED_PART_CONTENT_2 =
  "Simple tables have a uniform number of columns and rows, without any merged cells:";
const PDF_FILE_PATH = "data/pe_deal_examples.pdf";
const PNG_FILE_PATH = "data/receipt.png";
const OFFICE_FILE_PATH = "data/sample3.docx.doc";

async function toMulterFile(
  filePath: string,
  mimetype: string,
): Promise<Express.Multer.File> {
  const buf = await readFile(filePath);
  const basename = path.basename(filePath);
  return {
    buffer: buf,
    fieldname: "file",
    originalname: basename,
    mimetype,
    encoding: "",
    size: buf.length,
    destination: "",
    filename: basename,
    path: filePath,
    stream: new Stream.Readable(),
  };
}

describe("Test parse", () => {
  it("Test parse PDF file (pages, no config)", async () => {
    const file = await toMulterFile(PDF_FILE_PATH, "application/pdf");
    const result = await parse({ file });
    expect(typeof result !== "string").toBe(true);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2); // PDF has two pages
    expect(
      (result[0] as ParsedPage).text.includes(
        PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_1,
      ),
    ).toBe(true);
    expect(
      (result[1] as ParsedPage).text.includes(
        PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_2,
      ),
    ).toBe(true);
  });

  it("Test parse PDF file (text, no config)", async () => {
    const file = await toMulterFile(PDF_FILE_PATH, "application/pdf");
    const result = await parse({ file, text: true });
    expect(typeof result === "string").toBe(true);
    expect(
      (result as string).includes(PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_1),
    ).toBe(true);
    expect(
      (result as string).includes(PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_2),
    ).toBe(true);
  });

  it("Test parse PDF file (pages, w/config)", async () => {
    const file = await toMulterFile(PDF_FILE_PATH, "application/pdf");
    const config: Partial<LiteParseConfig> = { targetPages: "1" };
    const result = await parse({ file, config });
    expect(typeof result !== "string").toBe(true);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1); // PDF has two pages, but we choose only the first as target page
    expect(
      (result[0] as ParsedPage).text.includes(
        PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_1,
      ),
    ).toBe(true);
    expect(
      (result[0] as ParsedPage).text.includes(
        PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_2,
      ),
    ).toBe(false);
  });

  it("Test parse PDF file (text, w/config)", async () => {
    const file = await toMulterFile(PDF_FILE_PATH, "application/pdf");
    const config: Partial<LiteParseConfig> = { targetPages: "1" };
    const result = await parse({ file, text: true, config });
    expect(typeof result === "string").toBe(true);
    expect(
      (result as string).includes(PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_1),
    ).toBe(true);
    expect(
      (result as string).includes(PE_DEAL_EXAMPLES_EXPECTED_PART_CONTENT_2),
    ).toBe(false);
  });

  it("Test parse PNG file (pages, no config)", async () => {
    const file = await toMulterFile(PNG_FILE_PATH, "image/png");
    const result = await parse({ file });
    expect(typeof result !== "string").toBe(true);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1); // receipt is clearly 1 page
    expect(
      (result[0] as ParsedPage).text.includes(RECEIPT_EXPECTED_PART_CONTENT),
    ).toBe(true);
  });

  it("Test parse PNG file (pages, w/config)", async () => {
    const file = await toMulterFile(PNG_FILE_PATH, "image/png");
    const config: Partial<LiteParseConfig> = { dpi: 200 };
    const result = await parse({ file, config });
    expect(typeof result !== "string").toBe(true);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1); // receipt is clearly 1 page
    expect(
      (result[0] as ParsedPage).text.includes(RECEIPT_EXPECTED_PART_CONTENT),
    ).toBe(true);
  });

  it("Test parse PNG file (text, w/config)", async () => {
    const file = await toMulterFile(PNG_FILE_PATH, "image/png");
    const config: Partial<LiteParseConfig> = { dpi: 200 };
    const result = await parse({ file, config, text: true });
    expect(typeof result === "string").toBe(true);
    expect((result as string).includes(RECEIPT_EXPECTED_PART_CONTENT)).toBe(
      true,
    );
  });

  it("Test parse PNG file (text, no config)", async () => {
    const file = await toMulterFile(PNG_FILE_PATH, "image/png");
    const result = await parse({ file, text: true });
    expect(typeof result === "string").toBe(true);
    expect((result as string).includes(RECEIPT_EXPECTED_PART_CONTENT)).toBe(
      true,
    );
  });

  it("Test parse Office file (pages, no config)", async () => {
    const file = await toMulterFile(
      OFFICE_FILE_PATH,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const result = await parse({ file });
    expect(typeof result !== "string").toBe(true);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(
      (result[0] as ParsedPage).text.includes(
        SAMPLE_DOCX_EXPECTED_PART_CONTENT_1,
      ),
    ).toBe(true);
    expect(
      (result[1] as ParsedPage).text.includes(
        SAMPLE_DOCX_EXPECTED_PART_CONTENT_2,
      ),
    ).toBe(true);
  });

  it("Test parse Office file (pages, w/config)", async () => {
    const file = await toMulterFile(
      OFFICE_FILE_PATH,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const config: Partial<LiteParseConfig> = { targetPages: "2" };
    const result = await parse({ file, config });
    expect(typeof result !== "string").toBe(true);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1); // only one target page
    // we expect content only from the second page
    expect(
      (result[0] as ParsedPage).text.includes(
        SAMPLE_DOCX_EXPECTED_PART_CONTENT_1,
      ),
    ).toBe(false);
    expect(
      (result[0] as ParsedPage).text.includes(
        SAMPLE_DOCX_EXPECTED_PART_CONTENT_2,
      ),
    ).toBe(true);
  });

  it("Test parse Office file (text, no config)", async () => {
    const file = await toMulterFile(
      OFFICE_FILE_PATH,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const result = await parse({ file, text: true });
    expect(typeof result === "string").toBe(true);
    expect(
      (result as string).includes(SAMPLE_DOCX_EXPECTED_PART_CONTENT_1),
    ).toBe(true);
    expect(
      (result as string).includes(SAMPLE_DOCX_EXPECTED_PART_CONTENT_2),
    ).toBe(true);
  });

  it("Test parse Office file (text, w/config)", async () => {
    const file = await toMulterFile(
      OFFICE_FILE_PATH,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const config: Partial<LiteParseConfig> = { targetPages: "2" };
    const result = await parse({ file, text: true, config });
    expect(typeof result === "string").toBe(true);
    // Contains only content from page 2
    expect(
      (result as string).includes(SAMPLE_DOCX_EXPECTED_PART_CONTENT_1),
    ).toBe(false);
    expect(
      (result as string).includes(SAMPLE_DOCX_EXPECTED_PART_CONTENT_2),
    ).toBe(true);
  });
});

describe("Test screenshot", () => {
  it("Test screenshot PDF file (all pages, no config)", async () => {
    const file = await toMulterFile(PDF_FILE_PATH, "application/pdf");
    const result = await screenshot({ file });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2); // PDF has two pages
    for (let i = 0; i < result.length; i++) {
      expect(result[i]?.pageNum).toBe(i + 1);
      expect(Buffer.isBuffer(result[i]?.imageBuffer)).toBe(true);
      expect(result[i]?.imageBuffer.length).toBeGreaterThan(0);
      expect(typeof result[i]?.width).toBe("number");
      expect(result[i]?.width).toBeGreaterThan(0);
      expect(typeof result[i]?.height).toBe("number");
      expect(result[i]?.height).toBeGreaterThan(0);
    }
  });

  it("Test screenshot PDF file (specific page)", async () => {
    const file = await toMulterFile(PDF_FILE_PATH, "application/pdf");
    const result = await screenshot({ file, pageNumbers: [1] });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0]?.pageNum).toBe(1);
    expect(Buffer.isBuffer(result[0]?.imageBuffer)).toBe(true);
    expect(result[0]?.imageBuffer.length).toBeGreaterThan(0);
  });

  it("Test screenshot PDF file (multiple specific pages)", async () => {
    const file = await toMulterFile(PDF_FILE_PATH, "application/pdf");
    const result = await screenshot({ file, pageNumbers: [1, 2] });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0]?.pageNum).toBe(1);
    expect(result[1]?.pageNum).toBe(2);
  });

  it("Test screenshot PNG file (all pages, no config)", async () => {
    const file = await toMulterFile(PNG_FILE_PATH, "image/png");
    const result = await screenshot({ file });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1); // receipt is one page
    expect(result[0]?.pageNum).toBe(1);
    expect(Buffer.isBuffer(result[0]?.imageBuffer)).toBe(true);
    expect(result[0]?.imageBuffer.length).toBeGreaterThan(0);
    expect(typeof result[0]?.width).toBe("number");
    expect(result[0]?.width).toBeGreaterThan(0);
    expect(typeof result[0]?.height).toBe("number");
    expect(result[0]?.height).toBeGreaterThan(0);
  });
});
