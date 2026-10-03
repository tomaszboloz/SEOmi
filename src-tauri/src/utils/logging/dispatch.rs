use super::{
    commands::IPC_COMMANDS,
    event::{emit, event, NativeEvent},
};
use std::{io, time::Instant};
use uuid::Uuid;

pub(super) fn dispatch_with_sink<F, S>(command: &str, handler: F, mut sink: S) -> bool
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
