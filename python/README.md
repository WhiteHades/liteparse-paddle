# PaddleOCR Service

This is a small FastAPI server that wraps PaddleOCR and exposes the OCR endpoint expected by LiteParse.

PaddleOCR is especially fast and accurate for Chinese, Japanese, and Korean languages.

## Build and Run

```bash
uv sync --dev
uv run server.py
```

## Usage

The service exposes:

- `POST /ocr` - Perform OCR on an uploaded image
- `GET /health` - Health check

### Parameters

- `file` - Image file (multipart/form-data)
- `language` - Language code (e.g., 'en', 'zh', 'ja', 'ko')

### Example

```bash
curl -X POST -F "file=@image.png" -F "language=zh" http://localhost:8829/ocr
```

### Response Format

```json
{
  "results": [
    {
      "text": "recognized text",
      "bbox": [x1, y1, x2, y2],
      "confidence": 0.95
    }
  ]
}
```

This matches LiteParse's OCR server response shape.

## Supported Languages

PaddleOCR supports 80+ languages with excellent support for CJK:

- `en` - English
- `zh` / `zh-cn` - Chinese (Simplified)
- `zh-tw` / `zh-hant` - Chinese (Traditional)
- `ja` - Japanese
- `ko` - Korean
- `fr` - French
- `de` - German
- `es` - Spanish
- `pt` - Portuguese
- `ru` - Russian
- `ar` - Arabic
- `hi` - Hindi/Devanagari

Full list: <https://github.com/PaddlePaddle/PaddleOCR>

## Performance

PaddleOCR is optimized for speed and accuracy:

- **Fast**: 2-3x faster than EasyOCR
- **Accurate**: Especially for Asian languages (Chinese, Japanese, Korean)
- **Lightweight**: Smaller model sizes

## Use with LiteParse

Once the server is running, use it with LiteParse:

```bash
# Parse with PaddleOCR
lit parse document.pdf --ocr-server-url http://localhost:8829/ocr

# With specific language
lit parse document.pdf --ocr-server-url http://localhost:8829/ocr --ocr-language zh
```

Or in code:

```typescript
import { LiteParse } from 'liteparse';

const parser = new LiteParse({
  ocrServerUrl: 'http://localhost:8829/ocr',
  ocrLanguage: 'zh',
});

const result = await parser.parse('document.pdf');
```

## Testing

```bash
uv sync --dev
uv run pytest test_server.py
```

## GPU Support

For GPU acceleration, switch the PaddlePaddle package source to a CUDA build and run the container with GPU access.

## Notes

- First request may be slow as PaddleOCR downloads models
- Models are cached after first use
- Default port is `8829`
