use super::http::*;
use super::models::*;
use super::render::*;
use tokio::{
    net::{TcpListener, TcpStream},
    sync::oneshot,
    time::{sleep_until, timeout, Instant},
};

pub(super) async fn run_worker(
    listener: TcpListener,
    shared: WorkerShared,
    mut shutdown: oneshot::Receiver<()>,
) {
    loop {
        tokio::select! {
            _ = &mut shutdown => break,
            _ = sleep_until(shared.expires_at) => break,
            accepted = listener.accept() => {
                let Ok((stream, peer)) = accepted else { break; };
                if !peer.ip().is_loopback() {
                    continue;
                }
                let connection_shared = shared.clone();
                tokio::spawn(async move {
                    let _ = timeout(REQUEST_TIMEOUT, handle_connection(stream, connection_shared)).await;
                });
            }
        }
    }
}

pub(super) async fn handle_connection(
    mut stream: TcpStream,
    shared: WorkerShared,
) -> Result<(), String> {
    let request = match read_request(&mut stream).await {
        Ok(request) => request,
        Err(error) => {
            return write_response(&mut stream, 400, "application/json", &json_error(&error)).await;
        }
    };
    let (status, content_type, body) = match (request.method.as_str(), request.path.as_str()) {
        ("GET", "/health") => {
            let expired = Instant::now() >= shared.expires_at;
            let body = serde_json::json!({
                "ok": !expired,
                "version": RENDER_WORKER_VERSION,
                "renderer": crate::commands::rendered_artifacts::renderer_platform(),
                "expiresAt": shared.expires_at_text,
                "expiresInSeconds": shared.expires_at.saturating_duration_since(Instant::now()).as_secs(),
            });
            (
                if expired { 410 } else { 200 },
                "application/json",
                serde_json::to_vec(&body).map_err(|error| error.to_string())?,
            )
        }
        ("POST", "/v1/render") => {
            if Instant::now() >= shared.expires_at {
                return write_response(
                    &mut stream,
                    410,
                    "application/json",
                    &json_error("Worker lease has expired."),
                )
                .await;
            }
            let version = request
                .headers
                .get("x-seomi-worker-version")
                .map(String::as_str);
            if version != Some(RENDER_WORKER_VERSION) {
                return write_response(
                    &mut stream,
                    426,
                    "application/json",
                    &json_error("Worker protocol version is not supported."),
                )
                .await;
            }
            let authorization = request.headers.get("authorization").map(String::as_str);
            if !bearer_matches(authorization, &shared.token).await {
                return write_response(
                    &mut stream,
                    401,
                    "application/json",
                    &json_error("Worker token is invalid or already used."),
                )
                .await;
            }
            let content_type = request.headers.get("content-type").map(String::as_str);
            if !content_type.is_some_and(|v| v.eq_ignore_ascii_case("application/json")) {
                return write_response(
                    &mut stream,
                    415,
                    "application/json",
                    &json_error("Worker requests must use Content-Type: application/json."),
                )
                .await;
            }
            let payload: RenderWorkerRequest = match serde_json::from_slice(&request.body) {
                Ok(payload) => payload,
                Err(error) => {
                    return write_response(
                        &mut stream,
                        400,
                        "application/json",
                        &json_error(&format!("Invalid render request: {error}")),
                    )
                    .await;
                }
            };
            let result = render_request(&shared.app, payload).await;
            match result {
                Ok(snapshot) => {
                    let body = serde_json::to_vec(&snapshot).map_err(|error| error.to_string())?;
                    if body.len() > 8 * 1024 * 1024 {
                        (
                            413,
                            "application/json",
                            json_error("Rendered snapshot exceeds the response safety limit."),
                        )
                    } else {
                        (200, "application/json", body)
                    }
                }
                Err(error) => (422, "application/json", json_error(&error)),
            }
        }
        _ => (
            404,
            "application/json",
            json_error("Worker route not found."),
        ),
    };
    write_response(&mut stream, status, content_type, &body).await
}
