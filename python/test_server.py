import io
from typing import Any

import pytest
from fastapi.testclient import TestClient
from paddleocr import PaddleOCR
from PIL import Image

import server as paddle_server_module
from server import PaddleOCRServer


@pytest.fixture(scope="module")
def server() -> PaddleOCRServer:
    return PaddleOCRServer()


class MockPaddleOcr:
    def __init__(self, *args, **kwargs) -> None:
        self.results = [
            {
                "res": {
                    "rec_texts": ["Hello World", "Total: $42.00", "Thank you!"],
                    "rec_scores": [0.98, 0.95, 0.87],
                    "rec_boxes": [
                        [10, 20, 200, 40],
                        [10, 50, 250, 70],
                        [10, 80, 180, 100],
                    ],
                    "rec_polys": [
                        [[10, 20], [200, 20], [200, 40], [10, 40]],
                        [[10, 50], [250, 50], [250, 70], [10, 70]],
                        [[10, 80], [180, 80], [180, 100], [10, 100]],
                    ],
                }
            }
        ]
        self.transformed_results = [
            {
                "text": "Hello World",
                "bbox": [10, 20, 200, 40],
                "confidence": 0.98,
                "polygon": [10, 20, 200, 20, 200, 40, 10, 40],
            },
            {
                "text": "Total: $42.00",
                "bbox": [10, 50, 250, 70],
                "confidence": 0.95,
                "polygon": [10, 50, 250, 50, 250, 70, 10, 70],
            },
            {
                "text": "Thank you!",
                "bbox": [10, 80, 180, 100],
                "confidence": 0.87,
                "polygon": [10, 80, 180, 80, 180, 100, 10, 100],
            },
        ]

    def predict(self, *args, **kwargs) -> list[Any]:
        return self.results


def test_server_init(server: PaddleOCRServer) -> None:
    assert server.current_language == "en"
    assert isinstance(server.ocr, PaddleOCR)


def test_server_health_endpoint(server: PaddleOCRServer) -> None:
    app = server._create_ocr_server()
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["tier"] == server.tier
    assert isinstance(body["paddleocr_version"], str)


def test_server_ocr_endpoint(server: PaddleOCRServer) -> None:
    image = Image.new("RGB", (1, 1), color=(255, 255, 255))

    # Save to bytes (to simulate a file upload)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    app = server._create_ocr_server()
    mock_ocr = MockPaddleOcr()
    server.ocr = mock_ocr  # type: ignore
    client = TestClient(app)

    response = client.post(
        "/ocr",
        files={"file": ("test.png", buffer, "image/png")},
        data={"language": "en"},
    )
    assert response.status_code == 200
    assert response.json().get("results", []) == mock_ocr.transformed_results


def test_server_normalizes_documented_language_aliases(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    image = Image.new("RGB", (1, 1), color=(255, 255, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)

    captured_langs: list[str] = []

    class CapturingPaddleOcr(MockPaddleOcr):
        def __init__(self, *args, **kwargs) -> None:
            captured_langs.append(kwargs.get("lang", ""))
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(paddle_server_module, "PaddleOCR", CapturingPaddleOcr)

    server = PaddleOCRServer()
    app = server._create_ocr_server()
    client = TestClient(app)

    response = client.post(
        "/ocr",
        files={"file": ("test.png", buffer, "image/png")},
        data={"language": "zh"},
    )

    assert response.status_code == 200
    assert captured_langs == ["en", "ch"]
    assert server.current_language == "ch"


def test_server_uses_v6_model_names(monkeypatch: pytest.MonkeyPatch) -> None:
    """Constructor must pass PP-OCRv6_<tier>_det/rec as the V6 model names."""
    captured: list[dict[str, Any]] = []

    class CapturingPaddleOcr:
        def __init__(self, *args, **kwargs) -> None:
            captured.append(kwargs)

    monkeypatch.setattr(paddle_server_module, "PaddleOCR", CapturingPaddleOcr)
    PaddleOCRServer()

    assert len(captured) == 1, f"expected exactly one PaddleOCR() call, got {len(captured)}"
    kwargs = captured[0]
    assert "text_detection_model_name" in kwargs, "missing text_detection_model_name kwarg"
    assert "text_recognition_model_name" in kwargs, "missing text_recognition_model_name kwarg"
    assert kwargs["text_detection_model_name"].startswith("PP-OCRv6_"), \
        f"expected PP-OCRv6_ prefix, got {kwargs['text_detection_model_name']}"
    assert kwargs["text_recognition_model_name"].startswith("PP-OCRv6_"), \
        f"expected PP-OCRv6_ prefix, got {kwargs['text_recognition_model_name']}"


def test_server_honors_paddle_ocr_tier_env_var(monkeypatch: pytest.MonkeyPatch) -> None:
    """PADDLE_OCR_TIER env var selects tiny|small|medium model tier."""
    captured: list[dict[str, Any]] = []

    class CapturingPaddleOcr:
        def __init__(self, *args, **kwargs) -> None:
            captured.append(kwargs)

    monkeypatch.setattr(paddle_server_module, "PaddleOCR", CapturingPaddleOcr)
    monkeypatch.setenv("PADDLE_OCR_TIER", "small")
    PaddleOCRServer()

    assert len(captured) == 1
    assert captured[0]["text_detection_model_name"] == "PP-OCRv6_small_det"
    assert captured[0]["text_recognition_model_name"] == "PP-OCRv6_small_rec"


def test_server_ocr_response_includes_polygon_from_rec_polys(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When PaddleOCR returns rec_polys (V6 4-point rotated boxes), the response
    must carry a flat 8-value polygon so the upstream Rust HTTP OCR engine can
    do rotation-recovery for non-axis-aligned text."""
    server = PaddleOCRServer()
    app = server._create_ocr_server()
    monkeypatch.setattr(server, "ocr", MockPaddleOcr())
    client = TestClient(app)

    image = Image.new("RGB", (1, 1), color=(255, 255, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)

    response = client.post(
        "/ocr",
        files={"file": ("test.png", buffer, "image/png")},
        data={"language": "en"},
    )
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 3
    for item in results:
        assert "polygon" in item
        assert item["polygon"] is not None
        assert len(item["polygon"]) == 8  # 4 points × 2 coords
    assert results[0]["polygon"] == [10, 20, 200, 20, 200, 40, 10, 40]
