use std::{
    env,
    io::Write,
    path::Path,
};

use axum::{
    Router,
    extract::{DefaultBodyLimit, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use axum_extra::extract::Multipart;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use liteparse::{LiteParse, LiteParseConfig, OutputFormat};
use serde::{Deserialize, Serialize};
use tempfile::{Builder, NamedTempFile};
use tower_http::cors::CorsLayer;

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ClientConfig {
    ocr_language: Option<String>,
    ocr_enabled: Option<bool>,
    ocr_server_url: Option<String>,
    output_format: Option<OutputFormat>,
    dpi: Option<f32>,
    max_pages: Option<usize>,
    target_pages: Option<String>,
    password: Option<String>,
    preserve_very_small_text: Option<bool>,
    precise_bounding_box: Option<bool>,
    tessdata_path: Option<String>,
    quiet: Option<bool>,
    num_workers: Option<usize>,
}

impl ClientConfig {
    fn into_liteparse_config(self, paddle_ocr_url: Option<String>) -> LiteParseConfig {
        let default_ocr_language = if self.ocr_server_url.is_some() || paddle_ocr_url.is_some() {
            "en"
        } else {
            "eng"
        };

        LiteParseConfig {
            ocr_language: self
                .ocr_language
                .unwrap_or_else(|| default_ocr_language.to_string()),
            ocr_enabled: self.ocr_enabled.unwrap_or(true),
            ocr_server_url: self.ocr_server_url.or(paddle_ocr_url),
            tessdata_path: self.tessdata_path,
            max_pages: self.max_pages.unwrap_or(1000),
            target_pages: self.target_pages,
            dpi: self.dpi.unwrap_or(150.0),
            output_format: self.output_format.unwrap_or(OutputFormat::Json),
            preserve_very_small_text: self.preserve_very_small_text.unwrap_or(false),
            password: self.password,
            quiet: self.quiet.unwrap_or(false),
            num_workers: self.num_workers.unwrap_or_else(default_num_workers),
        }
    }
}

impl ClientConfig {
    fn ignore_compat_only_fields(&self) {
        let _ = self.precise_bounding_box;
    }
}

#[derive(Clone)]
struct AppState {
    paddle_ocr_url: Option<String>,
}

#[derive(Deserialize)]
struct ParseQuery {
    text: Option<String>,
}

#[derive(Deserialize)]
struct ScreenshotQuery {
    pages: Option<String>,
}

#[derive(Serialize)]
struct ParseResponse {
    pages: Vec<liteparse::ParsedPage>,
}

#[derive(Serialize)]
struct ScreenshotLine {
    index: usize,
    mimetype: String,
    data: String,
    page_number: u32,
    height: u32,
    width: u32,
}

struct UploadPayload {
    filename: Option<String>,
    bytes: Vec<u8>,
    config: ClientConfig,
}

fn default_num_workers() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get().saturating_sub(1).max(1))
        .unwrap_or(1)
}

async fn read_upload(mut multipart: Multipart) -> Result<UploadPayload, Response> {
    let mut filename = None;
    let mut bytes = None;
    let mut config = ClientConfig::default();

    while let Ok(Some(field)) = multipart.next_field().await {
        match field.name() {
            Some("file") => {
                filename = field.file_name().map(str::to_owned);
                match field.bytes().await {
                    Ok(uploaded) => bytes = Some(uploaded.to_vec()),
                    Err(err) => {
                        return Err(
                            (StatusCode::BAD_REQUEST, format!("Invalid file upload: {err}"))
                                .into_response(),
                        )
                    }
                }
            }
            Some("config") => {
                if let Ok(raw) = field.text().await {
                    if !raw.trim().is_empty() {
                        match serde_json::from_str::<ClientConfig>(&raw) {
                            Ok(parsed) => config = parsed,
                            Err(err) => {
                                return Err(
                                    (
                                        StatusCode::BAD_REQUEST,
                                        format!("Invalid config JSON: {err}"),
                                    )
                                        .into_response(),
                                )
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    let bytes = match bytes {
        Some(bytes) if !bytes.is_empty() => bytes,
        _ => return Err((StatusCode::BAD_REQUEST, "No 'file' field provided").into_response()),
    };

    config.ignore_compat_only_fields();

    Ok(UploadPayload {
        filename,
        bytes,
        config,
    })
}

fn temp_suffix(filename: Option<&str>) -> String {
    filename
        .and_then(|name| Path::new(name).extension())
        .map(|ext| format!(".{}", ext.to_string_lossy()))
        .unwrap_or_else(|| ".pdf".to_string())
}

fn write_temp_upload(filename: Option<&str>, bytes: &[u8]) -> Result<NamedTempFile, String> {
    let suffix = temp_suffix(filename);
    let mut temp = Builder::new()
        .prefix("liteparse-")
        .suffix(&suffix)
        .tempfile()
        .map_err(|err| format!("Failed to create temp file: {err}"))?;

    temp.write_all(bytes)
        .map_err(|err| format!("Failed to write temp file: {err}"))?;
    temp.flush()
        .map_err(|err| format!("Failed to flush temp file: {err}"))?;

    Ok(temp)
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[tokio::main]
async fn main() {
    let paddle_ocr_url = env::var("PADDLE_OCR_URL").ok();

    let state = AppState { paddle_ocr_url };

    let app = Router::new()
        .route("/parse", post(parse_handler))
        .route("/screenshots", post(screenshot_handler))
        .route("/health", get(health_handler))
        .layer(DefaultBodyLimit::max(1024 * 1024 * 1024))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:5000").await.unwrap();
    println!("listening on port 5000");
    axum::serve(listener, app).await.unwrap();
}

async fn health_handler() -> StatusCode {
    StatusCode::OK
}

async fn parse_handler(
    State(state): State<AppState>,
    Query(query): Query<ParseQuery>,
    multipart: Multipart,
) -> Response {
    let payload = match read_upload(multipart).await {
        Ok(payload) => payload,
        Err(response) => return response,
    };

    let temp = match write_temp_upload(payload.filename.as_deref(), &payload.bytes) {
        Ok(temp) => temp,
        Err(err) => return (StatusCode::INTERNAL_SERVER_ERROR, err).into_response(),
    };

    let liteparse_config = payload.config.into_liteparse_config(state.paddle_ocr_url);
    let parser = LiteParse::new(liteparse_config);
    let input_path = path_string(temp.path());

    let result = match parser.parse(&input_path).await {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Parse error: {e}"),
            )
                .into_response()
        }
    };

    let text_only = query.text.as_deref() == Some("true");

    if text_only {
        (StatusCode::OK, [("Content-Type", "text/plain")], result.text).into_response()
    } else {
        let json = serde_json::to_string(&ParseResponse { pages: result.pages }).unwrap();
        (
            StatusCode::OK,
            [("Content-Type", "application/json")],
            json,
        )
            .into_response()
    }
}

async fn screenshot_handler(
    State(state): State<AppState>,
    Query(query): Query<ScreenshotQuery>,
    multipart: Multipart,
) -> Response {
    let payload = match read_upload(multipart).await {
        Ok(payload) => payload,
        Err(response) => return response,
    };

    let temp = match write_temp_upload(payload.filename.as_deref(), &payload.bytes) {
        Ok(temp) => temp,
        Err(err) => return (StatusCode::INTERNAL_SERVER_ERROR, err).into_response(),
    };

    let page_numbers: Option<Vec<u32>> = match &query.pages {
        Some(pages) if !pages.is_empty() => Some(
            pages
                .split(',')
                .filter_map(|s| s.trim().parse().ok())
                .collect(),
        ),
        _ => None,
    };

    let liteparse_config = payload.config.into_liteparse_config(state.paddle_ocr_url);
    let parser = LiteParse::new(liteparse_config);
    let input_path = path_string(temp.path());

    let results = match parser.screenshot(&input_path, page_numbers).await {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Screenshot error: {e}"),
            )
                .into_response()
        }
    };

    let mut ndjson = String::new();
    for (i, shot) in results.iter().enumerate() {
        let line = ScreenshotLine {
            index: i,
            mimetype: "image/png".to_string(),
            data: BASE64.encode(&shot.image_bytes),
            page_number: shot.page_num,
            height: shot.height,
            width: shot.width,
        };
        ndjson.push_str(&serde_json::to_string(&line).unwrap());
        ndjson.push('\n');
    }

    (
        StatusCode::OK,
        [("Content-Type", "application/x-ndjson")],
        ndjson,
    )
        .into_response()
}
