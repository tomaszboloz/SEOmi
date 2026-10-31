//! Native writer of the append-only crawl event log (#138). One recorder per
//! run owns the sequence, so the WebView never writes or numbers events.
use rusqlite::Connection;
use serde::Serialize;
use serde_json::{json, Value};

use super::control::CrawlControl;
use crate::commands::run_store::events::{append, StoredEvent};

pub struct EventRecorder {
    conn: Connection,
    project: String,
    run: String,
    next_seq: i64,
    /// First write error; after it nothing more is written, so the log never has a gap.
    error: Option<String>,
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_millis() as i64)
}

impl EventRecorder {
    pub fn new(conn: Connection, project: &str, run: &str) -> Self {
        Self {
            conn,
            project: project.into(),
            run: run.into(),
            next_seq: 1,
            error: None,
        }
    }

    pub fn record(&mut self, kind: &str, payload: Value) {
        if self.error.is_some() {
            return;
        }
        let event = StoredEvent {
            seq: self.next_seq,
            kind: kind.into(),
            at_ms: now_ms(),
            payload,
        };
        match append(&mut self.conn, &self.project, &self.run, &event) {
            Ok(()) => self.next_seq += 1,
            Err(error) => {
                log::warn!("crawl event log disabled for run {}: {error}", self.run);
                self.error = Some(error);
            }
        }
    }

    pub fn error(&self) -> Option<&str> {
        self.error.as_deref()
    }
}

/// Terminal event kind for a finished pipeline.
pub fn terminal_kind(cancelled: bool, timed_out: bool, failed: bool) -> &'static str {
    match (failed, cancelled, timed_out) {
        (true, _, _) => "failed",
        (_, true, _) => "cancelled",
        (_, _, true) => "timed_out",
        _ => "completed",
    }
}

impl CrawlControl {
    pub(super) fn attach_recorder(&self, run_id: &str, recorder: EventRecorder) {
        if let Ok(mut recorders) = self.recorders.lock() {
            recorders.insert(run_id.to_owned(), recorder);
        }
    }

    /// Appends to the run's log when one is attached; a crawl without a project has none.
    pub(super) fn record_event<T: Serialize>(&self, run_id: &str, kind: &str, payload: &T) {
        let Ok(mut recorders) = self.recorders.lock() else {
            return;
        };
        if let Some(recorder) = recorders.get_mut(run_id) {
            recorder.record(kind, serde_json::to_value(payload).unwrap_or(Value::Null));
        }
    }

    /// Writes the terminal event, detaches the recorder and returns its first error.
    pub(super) fn finish_recorder(&self, run_id: &str, kind: &str, pages: usize) -> Option<String> {
        let mut recorder = self.recorders.lock().ok()?.remove(run_id)?;
        recorder.record(kind, json!({ "pages": pages }));
        recorder.error().map(str::to_owned)
    }
}

#[cfg(test)]
#[path = "event_recorder_tests.rs"]
mod tests;
