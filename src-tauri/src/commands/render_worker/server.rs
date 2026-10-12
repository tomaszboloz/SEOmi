use super::http::*;
use super::models::*;
use super::render::*;
use crate::commands::rendered_crawler::RenderedPageSnapshot;
use tauri::Runtime;
use tokio::{
    net::{TcpListener, TcpStream},
    sync::oneshot,
    time::{sleep_until, timeout, Instant},
};

pub(super) enum Admission {
    Serve(TcpStream),
    Skip,
    Stop,
}

/// Only loopback peers may talk to the worker; an accept failure stops the listener.
pub(super) fn admit_connection(
    accepted: std::io::Result<(TcpStream, std::net::SocketAddr)>,
) -> Admission {
    match accepted {
        Ok((stream, peer)) if peer.ip().is_loopback() => Admission::Serve(stream),
        Ok(_) => Admission::Skip,
        Err(_) => Admission::Stop,
    }
}

pub(super) async fn run_worker<R: Runtime>(
    listener: TcpListener,
    shared: WorkerShared<R>,
    mut shutdown: oneshot::Receiver<()>,
) {
    loop {
        tokio::select! {
            _ = &mut shutdown => break,
            _ = sleep_until(shared.expires_at) => break,
            accepted = listener.accept() => {
                let stream = match admit_connection(accepted) {
                    Admission::Serve(stream) => stream,
                    Admission::Skip => continue,
                    Admission::Stop => break,
                };
                let connection_shared = shared.clone();
                tokio::spawn(async move {
                    let _ = timeout(REQUEST_TIMEOUT, handle_connection(stream, connection_shared)).await;
                });
            }
        }
    }
}

pub(super) use super::http::format_render_snapshot;

pub(super) async fn handle_connection<R: Runtime>(
    stream: TcpStream,
    shared: WorkerShared<R>,
) -> Result<(), String> {
    let app = shared.app.clone();
    handle_connection_with(stream, shared, move |req| async move {
        render_request(&app, req).await
    })
    .await
}

fn render_guard(
    request: &HttpRequest,
    shared: &WorkerShared<impl Runtime>,
) -> Option<(u16, &'static str)> {
    if Instant::now() >= shared.expires_at {
        Some((410, "Worker lease has expired."))
    } else if request
        .headers
        .get("x-seomi-worker-version")
        .map(String::as_str)
        != Some(RENDER_WORKER_VERSION)
    {
        Some((426, "Worker protocol version is not supported."))
    } else {
        None
    }
}

pub(super) async fn handle_connection_with<R: Runtime, F, Fut>(
    mut stream: TcpStream,
    shared: WorkerShared<R>,
    render: F,
) -> Result<(), String>
where
    F: FnOnce(RenderWorkerRequest) -> Fut,
    Fut: std::future::Future<Output = Result<RenderedPageSnapshot, String>>,
{
    let request = match read_request(&mut stream).await {
        Ok(request) => request,
        Err(error) => {
            return write_response(&mut stream, 400, "application/json", &json_error(&error)).await;
        }
    };
    let (status, content_type, body) = match (request.method.as_str(), request.path.as_str()) {
        ("GET", "/health") => health_response(&shared)?,
        ("POST", "/v1/render") => {
            if let Some((status, msg)) = render_guard(&request, &shared) {
                return write_response(&mut stream, status, "application/json", &json_error(msg))
                    .await;
            }
            let auth = request.headers.get("authorization").map(String::as_str);
            if !bearer_matches(auth, &shared.token).await {
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
            let result = render(payload).await;
            match result {
                Ok(snapshot) => format_render_snapshot(&snapshot)?,
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
