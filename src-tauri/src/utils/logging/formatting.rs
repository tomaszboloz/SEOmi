use super::{
    commands::IPC_COMMANDS,
    event::{emit, event, NativeEvent},
    layer::NativeTaskLayer,
};
use std::{io::Write, sync::Arc};
use tracing_subscriber::prelude::*;
use uuid::Uuid;

pub(super) fn format_record(record: &log::Record<'_>) -> String {
    // Dependencies can write arbitrary messages containing URLs or local paths.
    // Preserve level and a stable diagnostic code, never their untrusted text.
    let structured = if record.target() == "seomi::event" {
        serde_json::from_str::<NativeEvent>(&record.args().to_string())
            .ok()
            .filter(valid_event)
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

pub(super) fn valid_event(entry: &NativeEvent) -> bool {
    matches!(entry.level.as_str(), "info" | "warn" | "error")
        && matches!(
            entry.event.as_str(),
            "ipc_received"
                | "ipc_dispatched"
                | "ipc_task_started"
                | "ipc_task_closed"
                | "audit_queue_failed"
                | "scheduled_task_failed"
                | "crawl_backup_restore_failed"
                | "crawl_backup_cleanup_failed"
                | "framework_diagnostic"
        )
        && (matches!(entry.route.as_str(), "native" | "unknown")
            || IPC_COMMANDS.contains(&entry.route.as_str()))
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
