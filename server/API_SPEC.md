# API Specification

Base URL: `http://localhost:5000`

### `POST /parse` — parse a single file

Parses a single document and returns either structured page data or plain text.

**Form fields:**

| Field    | Type   | Required | Description                               |
| -------- | ------ | -------- | ----------------------------------------- |
| `file`   | file   | ✅       | The document to parse                     |
| `config` | string | ❌       | JSON-serialized `LiteParseConfig` options |

**Query parameters:**

| Parameter | Type    | Default | Description                                                                        |
| --------- | ------- | ------- | ---------------------------------------------------------------------------------- |
| `text`    | boolean | `false` | If `true`, returns `text/plain`; otherwise `application/json` with a `pages` array |

**Responses:**

- `200 text/plain` — extracted text (when `text=true`)
- `200 application/json` — `{ "pages": [...] }` (when `text=false`)
- `400` — missing `file`
- `429` — rate limit exceeded

---

### `POST /screenshots` — screenshot pages of a document

Renders document pages as PNG images and streams them back as newline-delimited JSON (NDJSON).

**Form fields:**

| Field    | Type   | Required | Description                               |
| -------- | ------ | -------- | ----------------------------------------- |
| `file`   | file   | ✅       | The document to screenshot                |
| `config` | string | ❌       | JSON-serialized `LiteParseConfig` options |

**Query parameters:**

| Parameter | Type   | Default | Description                                                       |
| --------- | ------ | ------- | ----------------------------------------------------------------- |
| `pages`   | string | all     | Comma-separated 1-based page numbers to screenshot (e.g. `1,2,3`) |

**Response `200 application/x-ndjson`** — one JSON object per line:

```json
{
  "index": 0,
  "mimetype": "image/png",
  "data": "<base64>",
  "page_number": 1,
  "height": 1056,
  "width": 816
}
```
