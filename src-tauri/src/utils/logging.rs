use serde::{Deserialize, Serialize};
use std::io::{self, Write};
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tracing::{
    span::{Attributes, Id},
    Subscriber,
};
use tracing_subscriber::{layer::Context, prelude::*, registry::LookupSpan, Layer};
use uuid::Uuid;

// Kept in sync with generate_handler by an architecture test. Arbitrary command
// strings never reach a log sink, including denied/unknown commands.
const IPC_COMMANDS: &[&str] = &[
    "detect_ai_clis",
    "test_ai_cli_connection",
    "run_ai_cli",
    "load_project_audit_queue",
    "save_project_audit_queue",
    "delete_project_audit_queue",
    "list_project_audit_queue_executions",
    "acknowledge_project_audit_queue_execution",
    "list_project_audit_queue_results",
    "acknowledge_project_audit_queue_result",
    "load_project_crawl_runs",
    "save_project_crawl_runs",
    "load_project_crawl_checkpoint",
    "save_project_crawl_checkpoint",
    "delete_project_crawl_checkpoint",
    "inspect_url",
    "cancel_inspect_url",
    "check_link",
    "check_external_crawl_links",
    "write_mcp_config_file",
    "discover_mcp_tools",
    "get_config",
    "save_config",
    "get_secret",
    "set_secret",
    "save_crawl_auth_profile",
    "delete_crawl_auth_profile",
    "dataforseo_request",
    "run_pagespeed_insights",
    "query_crux_record",
    "connect_search_console",
    "list_search_console_properties",
    "search_console_performance",
    "inspect_search_console_url",
    "disconnect_search_console",
    "generate_audit_pdf",
    "generate_crawl_pdf",
    "render_crawl_page",
    "capture_rendered_artifact",
    "open_rendered_element_preview",
    "start_render_worker",
    "stop_render_worker",
    "render_worker_status",
    "register_audit_wakeup",
    "unregister_audit_wakeup",
    "register_audit_queue_wakeup",
    "unregister_audit_queue_wakeup",
    "scheduled_launch_context",
    "save_scheduled_task",
    "delete_scheduled_task",
    "load_scheduled_execution",
    "list_scheduled_executions",
    "acknowledge_scheduled_execution",
    "check_for_updates",
    "install_update",
    "crawl_site",
    "validate_crawl_filters",
    "cancel_site_crawl",
    "pause_site_crawl",
    "resume_site_crawl",
];

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct NativeEvent {
    level: String,
    event: String,
    request_id: Uuid,
    timestamp_ms: u128,
    route: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    accepted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    dispatch_duration_ms: Option<u128>,
    #[serde(skip_serializing_if = "Option::is_none")]
    task_duration_ms: Option<u128>,
    #[serde(skip_serializing_if = "Option::is_none")]
    task_started: Option<bool>,
}

fn event(level: &str, name: &str, request_id: Uuid, route: &str) -> NativeEvent {
    NativeEvent {
        level: level.to_owned(),
        event: name.to_owned(),
        request_id,
        timestamp_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        route: route.to_owned(),
        accepted: None,
        dispatch_duration_ms: None,
        task_duration_ms: None,
        task_started: None,
    }
}

fn emit(event: &NativeEvent) -> io::Result<()> {
    let json = serde_json::to_string(event)?;
    match event.level.as_str() {
        "error" => log::error!(target: "seomi::event", "{json}"),
        "warn" => log::warn!(target: "seomi::event", "{json}"),
        _ => log::info!(target: "seomi::event", "{json}"),
    }
    Ok(())
}

fn format_record(record: &log::Record<'_>) -> String {
    // Dependencies can write arbitrary messages containing URLs or local paths.
    // Preserve level and a stable diagnostic code, never their untrusted text.
    let structured = if record.target() == "seomi::event" {
        serde_json::from_str::<NativeEvent>(&record.args().to_string()).ok()
    } else {
        None
    };
    let data = structured.unwrap_or_else(|| {
        event(
            &record.level().to_string().to_lowercase(),
            "framework_diagnostic",
            Uuid::new_v4(),
            "native",
        )
    });
    serde_json::to_string(&data).expect("NativeEvent contains only serializable primitive fields")
}

pub fn init() {
    let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format(|buf, record| writeln!(buf, "{}", format_record(record)))
        .try_init();
    let _ = tracing_subscriber::registry()
        .with(NativeTaskLayer {
            sink: Arc::new(emit),
        })
        .try_init();
}

#[derive(Clone)]
struct RequestContext {
    request_id: Uuid,
    route: String,
}

struct TaskContext {
    request: RequestContext,
    created: Instant,
    started: Option<Instant>,
}

#[derive(Default)]
struct RequestFields {
    request_id: Option<Uuid>,
    route: String,
}

impl tracing::field::Visit for RequestFields {
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        match field.name() {
            "request_id" => self.request_id = Uuid::parse_str(value).ok(),
            "route" => {
                self.route = IPC_COMMANDS
                    .iter()
                    .copied()
                    .find(|name| *name == value)
                    .unwrap_or("unknown")
                    .to_owned()
            }
            _ => {}
        }
    }
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        // Only our UUID field is rendered. Framework fields, including args,
        // URLs, errors and command names, are never formatted or collected.
        if field.name() == "request_id" {
            self.request_id = Uuid::parse_str(&format!("{value:?}")).ok();
        }
    }
}

type EventSink = Arc<dyn Fn(&NativeEvent) -> io::Result<()> + Send + Sync>;
struct NativeTaskLayer {
    sink: EventSink,
}

impl<S> Layer<S> for NativeTaskLayer
where
    S: Subscriber + for<'lookup> LookupSpan<'lookup>,
{
    fn on_new_span(&self, attributes: &Attributes<'_>, id: &Id, context: Context<'_, S>) {
        let Some(span) = context.span(id) else {
            return;
        };
        if attributes.metadata().name() == "seomi.ipc" {
            let mut fields = RequestFields::default();
            attributes.record(&mut fields);
            if let Some(request_id) = fields.request_id {
                span.extensions_mut().insert(RequestContext {
                    request_id,
                    route: fields.route,
                });
            }
        } else if attributes.metadata().name() == "ipc::request::run" {
            let request = span
                .scope()
                .skip(1)
                .find_map(|ancestor| ancestor.extensions().get::<RequestContext>().cloned());
            if let Some(request) = request {
                span.extensions_mut().insert(TaskContext {
                    request,
                    created: Instant::now(),
                    started: None,
                });
            }
        }
    }

    fn on_enter(&self, id: &Id, context: Context<'_, S>) {
        let Some(span) = context.span(id) else {
            return;
        };
        let request = {
            let mut extensions = span.extensions_mut();
            let Some(task) = extensions.get_mut::<TaskContext>() else {
                return;
            };
            if task.started.is_some() {
                return;
            }
            task.started = Some(Instant::now());
            task.request.clone()
        };
        let _ = (self.sink)(&event(
            "info",
            "ipc_task_started",
            request.request_id,
            &request.route,
        ));
    }

    fn on_close(&self, id: Id, context: Context<'_, S>) {
        let Some(span) = context.span(&id) else {
            return;
        };
        let extensions = span.extensions();
        let Some(task) = extensions.get::<TaskContext>() else {
            return;
        };
        let mut closed = event(
            "info",
            "ipc_task_closed",
            task.request.request_id,
            &task.request.route,
        );
        closed.task_duration_ms = Some(task.started.unwrap_or(task.created).elapsed().as_millis());
        closed.task_started = Some(task.started.is_some());
        let _ = (self.sink)(&closed);
    }
}

fn dispatch_with_sink<F, S>(command: &str, handler: F, mut sink: S) -> bool
where
    F: FnOnce() -> bool,
    S: FnMut(&NativeEvent) -> io::Result<()>,
{
    let route = IPC_COMMANDS
        .iter()
        .copied()
        .find(|name| *name == command)
        .unwrap_or("unknown");
    let request_id = Uuid::new_v4();
    let started = Instant::now();
    let _ = sink(&event("info", "ipc_received", request_id, route));
    let accepted = {
        let span = tracing::info_span!("seomi.ipc", request_id = %request_id, route);
        let _entered = span.enter();
        handler()
    };
    let mut completed = event(
        if accepted { "info" } else { "warn" },
        "ipc_dispatched",
        request_id,
        route,
    );
    completed.accepted = Some(accepted);
    completed.dispatch_duration_ms = Some(started.elapsed().as_millis());
    let _ = sink(&completed);
    accepted
}

/// The Tauri-generated execution span inherits this request context across
/// async polls. Span closure also covers dropped/cancelled futures, and never
/// claims successful response delivery or logs command results.
pub fn dispatch(command: &str, handler: impl FnOnce() -> bool) -> bool {
    dispatch_with_sink(command, handler, emit)
}

#[derive(Clone, Copy)]
pub enum Diagnostic {
    AuditQueueFailed,
    ScheduledTaskFailed,
    CrawlBackupRestoreFailed,
    CrawlBackupCleanupFailed,
}

fn diagnostic_event(kind: Diagnostic) -> NativeEvent {
    let (level, name) = match kind {
        Diagnostic::AuditQueueFailed => ("error", "audit_queue_failed"),
        Diagnostic::ScheduledTaskFailed => ("error", "scheduled_task_failed"),
        Diagnostic::CrawlBackupRestoreFailed => ("warn", "crawl_backup_restore_failed"),
        Diagnostic::CrawlBackupCleanupFailed => ("warn", "crawl_backup_cleanup_failed"),
    };
    event(level, name, Uuid::new_v4(), "native")
}

pub fn diagnostic(kind: Diagnostic) {
    let _ = emit(&diagnostic_event(kind));
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use tracing::{instrument::WithSubscriber, Instrument};

    fn task_fixture() -> (tracing::Dispatch, Arc<Mutex<Vec<serde_json::Value>>>) {
        let records = Arc::new(Mutex::new(Vec::new()));
        let sink_records = records.clone();
        let subscriber = tracing_subscriber::registry().with(NativeTaskLayer {
            sink: Arc::new(move |entry| {
                sink_records
                    .lock()
                    .unwrap()
                    .push(serde_json::to_value(entry).unwrap());
                Ok(())
            }),
        });
        (tracing::Dispatch::new(subscriber), records)
    }

    #[tokio::test]
    async fn async_span_retains_dispatch_id_until_the_deferred_native_future_settles() {
        let (subscriber, records) = task_fixture();
        let mut task_span = None;
        tracing::dispatcher::with_default(&subscriber, || {
            assert!(dispatch_with_sink(
                "get_secret",
                || {
                    task_span = Some(tracing::debug_span!(
                        "ipc::request::run",
                        ignored = "token=secret"
                    ));
                    true
                },
                |entry| {
                    records
                        .lock()
                        .unwrap()
                        .push(serde_json::to_value(entry).unwrap());
                    Ok(())
                }
            ));
        });
        assert_eq!(records.lock().unwrap().len(), 2);
        let (release, deferred) = tokio::sync::oneshot::channel::<()>();
        let task = tokio::spawn(
            async move {
                deferred.await.unwrap();
                Err::<(), _>("private result is preserved")
            }
            .instrument(task_span.take().unwrap())
            .with_subscriber(subscriber),
        );
        tokio::task::yield_now().await;
        assert_eq!(records.lock().unwrap().len(), 3);
        release.send(()).unwrap();
        assert_eq!(task.await.unwrap(), Err("private result is preserved"));
        let records = records.lock().unwrap();
        assert_eq!(records.len(), 4);
        assert_eq!(records[2]["event"], "ipc_task_started");
        assert_eq!(records[3]["event"], "ipc_task_closed");
        assert_eq!(records[3]["task_started"], true);
        assert!(records[3]["task_duration_ms"].is_number());
        assert!(records
            .iter()
            .all(|entry| entry["request_id"] == records[0]["request_id"]
                && entry["route"] == "get_secret"));
        let json = serde_json::to_string(&*records).unwrap();
        assert!(!json.contains("token=secret") && !json.contains("private result"));
    }

    #[test]
    fn native_spans_track_reentry_and_unpolled_cancellation_without_claiming_success() {
        let (subscriber, records) = task_fixture();
        tracing::dispatcher::with_default(&subscriber, || {
            dispatch_with_sink(
                "inspect_url",
                || {
                    let task = tracing::debug_span!("ipc::request::run");
                    for _ in 0..3 {
                        let _entered = task.enter();
                    }
                    true
                },
                |_| Ok(()),
            );
            dispatch_with_sink(
                "crawl_site",
                || {
                    let _unpolled = tracing::debug_span!("ipc::request::run");
                    true
                },
                |_| Ok(()),
            );
            // Unrelated framework spans and events are ignored entirely.
            let _unrelated =
                tracing::info_span!("framework", url = "https://user:secret@example.com").entered();
            tracing::error!(secret = "never log this");
        });
        let records = records.lock().unwrap();
        assert_eq!(records.len(), 3);
        assert_eq!(records[0]["event"], "ipc_task_started");
        assert_eq!(records[1]["task_started"], true);
        assert_eq!(records[2]["task_started"], false);
        assert_ne!(records[1]["request_id"], records[2]["request_id"]);
        assert!(records.iter().all(|entry| entry.get("success").is_none()));
    }

    #[test]
    fn task_sink_failure_and_untrusted_routes_cannot_change_execution_or_expose_inputs() {
        let records = Arc::new(Mutex::new(Vec::new()));
        let observed = records.clone();
        let subscriber = tracing_subscriber::registry().with(NativeTaskLayer {
            sink: Arc::new(move |entry| {
                observed
                    .lock()
                    .unwrap()
                    .push(serde_json::to_value(entry).unwrap());
                Err(io::Error::other("log unavailable"))
            }),
        });
        tracing::subscriber::with_default(subscriber, || {
            assert!(!dispatch_with_sink(
                "url=https://user:password@example.com",
                || {
                    let span = tracing::debug_span!("ipc::request::run");
                    let _entered = span.enter();
                    false
                },
                |_| Err(io::Error::other("dispatch sink unavailable"))
            ));
        });
        let records = records.lock().unwrap();
        assert_eq!(records.len(), 2);
        assert!(records.iter().all(|entry| entry["route"] == "unknown"));
        assert!(!serde_json::to_string(&*records)
            .unwrap()
            .contains("password"));
    }

    #[tokio::test]
    async fn cancelling_a_polled_future_closes_its_native_span() {
        let (subscriber, records) = task_fixture();
        let mut span = None;
        tracing::dispatcher::with_default(&subscriber, || {
            dispatch_with_sink(
                "run_ai_cli",
                || {
                    span = Some(tracing::debug_span!("ipc::request::run"));
                    true
                },
                |_| Ok(()),
            );
        });
        let (entered, ready) = tokio::sync::oneshot::channel();
        let task = tokio::spawn(
            async move {
                entered.send(()).unwrap();
                std::future::pending::<()>().await;
            }
            .instrument(span.unwrap())
            .with_subscriber(subscriber),
        );
        ready.await.unwrap();
        task.abort();
        assert!(task.await.unwrap_err().is_cancelled());
        let records = records.lock().unwrap();
        assert_eq!(records.len(), 2);
        assert_eq!(records[1]["event"], "ipc_task_closed");
        assert_eq!(records[1]["task_started"], true);
        assert_eq!(records[0]["request_id"], records[1]["request_id"]);
    }

    #[test]
    fn concurrent_native_spans_keep_their_own_request_contexts() {
        let (subscriber, records) = task_fixture();
        let threads: Vec<_> = (0..16)
            .map(|_| {
                let subscriber = subscriber.clone();
                std::thread::spawn(move || {
                    tracing::dispatcher::with_default(&subscriber, || {
                        dispatch_with_sink(
                            "get_config",
                            || {
                                let span = tracing::debug_span!("ipc::request::run");
                                let _entered = span.enter();
                                true
                            },
                            |_| Ok(()),
                        );
                    })
                })
            })
            .collect();
        for thread in threads {
            thread.join().unwrap();
        }
        let records = records.lock().unwrap();
        assert_eq!(records.len(), 32);
        let ids: std::collections::HashSet<_> = records
            .iter()
            .map(|entry| entry["request_id"].as_str().unwrap())
            .collect();
        assert_eq!(ids.len(), 16);
        for id in ids {
            let pair: Vec<_> = records
                .iter()
                .filter(|entry| entry["request_id"] == id)
                .collect();
            assert_eq!(pair.len(), 2);
            assert_eq!(pair[0]["event"], "ipc_task_started");
            assert_eq!(pair[1]["event"], "ipc_task_closed");
        }
    }

    #[test]
    fn dispatch_preserves_outcome_and_correlates_json_without_input_payloads() {
        for accepted in [true, false] {
            let mut records = Vec::new();
            let mut calls = 0;
            let result = dispatch_with_sink(
                "get_secret",
                || {
                    calls += 1;
                    accepted
                },
                |entry| {
                    records.push(serde_json::to_value(entry).unwrap());
                    Ok(())
                },
            );
            assert_eq!(result, accepted);
            assert_eq!(calls, 1);
            assert_eq!(records.len(), 2);
            assert_eq!(records[0]["event"], "ipc_received");
            assert_eq!(records[1]["event"], "ipc_dispatched");
            assert_eq!(records[0]["request_id"], records[1]["request_id"]);
            assert!(Uuid::parse_str(records[0]["request_id"].as_str().unwrap()).is_ok());
            assert_eq!(records[1]["accepted"], accepted);
            assert_eq!(records[1]["level"], if accepted { "info" } else { "warn" });
            assert!(records[1]["dispatch_duration_ms"].is_number());
            assert!(records
                .iter()
                .all(|r| r.get("args").is_none() && r.get("error").is_none()));
        }
    }

    #[test]
    fn unknown_commands_and_log_io_failures_cannot_leak_or_change_dispatch() {
        let mut records = Vec::new();
        assert!(dispatch_with_sink(
            "secret_token_https://user:pass@example.com",
            || true,
            |entry| {
                records.push(serde_json::to_value(entry).unwrap());
                Err(io::Error::other("sink failed"))
            }
        ));
        assert_eq!(records[0]["route"], "unknown");
        assert!(!serde_json::to_string(&records)
            .unwrap()
            .contains("secret_token"));
        assert!(dispatch("get_config", || true));
    }

    #[test]
    fn concurrent_dispatches_receive_independent_ids() {
        let ids: Vec<_> = (0..16)
            .map(|_| {
                std::thread::spawn(|| {
                    let mut id = None;
                    dispatch_with_sink(
                        "inspect_url",
                        || true,
                        |entry| {
                            id = Some(entry.request_id);
                            Ok(())
                        },
                    );
                    id.unwrap()
                })
            })
            .map(|thread| thread.join().unwrap())
            .collect();
        assert_eq!(
            ids.iter().collect::<std::collections::HashSet<_>>().len(),
            16
        );
    }

    #[test]
    fn formatter_keeps_valid_events_and_suppresses_untrusted_framework_text() {
        let expected = event("warn", "ipc_dispatched", Uuid::new_v4(), "get_config");
        let json = serde_json::to_string(&expected).unwrap();
        let formatted = format_record(
            &log::Record::builder()
                .target("seomi::event")
                .args(format_args!("{json}"))
                .build(),
        );
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&formatted).unwrap(),
            serde_json::to_value(expected).unwrap()
        );
        for target in ["reqwest", "seomi::event"] {
            let formatted = format_record(
                &log::Record::builder()
                    .target(target)
                    .level(log::Level::Error)
                    .args(format_args!(
                        "token=secret /Users/person/private https://user:pass@example.com"
                    ))
                    .build(),
            );
            let value: serde_json::Value = serde_json::from_str(&formatted).unwrap();
            assert_eq!(value["event"], "framework_diagnostic");
            assert_eq!(value["level"], "error");
            assert!(
                !formatted.contains("secret")
                    && !formatted.contains("/Users/")
                    && !formatted.contains("example.com")
            );
        }
    }

    #[test]
    fn every_background_diagnostic_is_serializable_and_logger_initialization_is_idempotent() {
        init();
        init();
        for kind in [
            Diagnostic::AuditQueueFailed,
            Diagnostic::ScheduledTaskFailed,
            Diagnostic::CrawlBackupRestoreFailed,
            Diagnostic::CrawlBackupCleanupFailed,
        ] {
            let entry = diagnostic_event(kind);
            let json = serde_json::to_value(&entry).unwrap();
            assert_eq!(json["route"], "native");
            assert!(json["event"].as_str().unwrap().ends_with("_failed"));
            assert!(json["level"] == "warn" || json["level"] == "error");
            assert!(json.get("error").is_none());
            diagnostic(kind);
        }
    }
}
