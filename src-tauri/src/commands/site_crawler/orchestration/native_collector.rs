use chrono::Utc;
use rusqlite::Connection;
use serde_json::{json, Value};

use crate::commands::run_store::events::{append_events, load_events, max_seq, StoredCrawlEvent};
use crate::commands::site_crawler::models::CrawledPageSummary;
const TERMINAL: &[&str] = &[
    "crawl:completed",
    "crawl:cancelled",
    "crawl:timed_out",
    "crawl:interrupted",
];
pub struct NativeCrawlCollector {
    pub(crate) project_id: String,
    pub(crate) run_id: String,
    pub(crate) seq: i64,
    pub(crate) conn: Option<Connection>,
    started_at: String,
}

impl NativeCrawlCollector {
    pub fn new(
        project_id: Option<String>,
        run_id: String,
        conn: Option<Connection>,
    ) -> Result<Self, String> {
        let project_id = project_id.unwrap_or_default();
        let seq = match conn
            .as_ref()
            .filter(|_| !project_id.trim().is_empty() && !run_id.trim().is_empty())
        {
            Some(db) => max_seq(db, &project_id, &run_id)?,
            None => 0,
        };
        Ok(Self {
            project_id,
            run_id,
            seq,
            conn,
            started_at: Utc::now().to_rfc3339(),
        })
    }

    pub fn is_active(&self) -> bool {
        self.conn.is_some() && !self.project_id.trim().is_empty() && !self.run_id.trim().is_empty()
    }

    fn append(&mut self, event_type: &str, payload: Value) -> Result<(), String> {
        if !self.is_active() {
            return Ok(());
        }
        let event = StoredCrawlEvent {
            project_id: self.project_id.clone(),
            run_id: self.run_id.clone(),
            seq: self.seq + 1,
            event_type: event_type.into(),
            at: Utc::now().to_rfc3339(),
            payload,
        };
        let inserted = append_events(
            self.conn.as_mut().ok_or("Collector store unavailable")?,
            &self.project_id,
            &self.run_id,
            &[event],
        )?;
        if inserted == 1 {
            self.seq += 1;
        }
        Ok(())
    }

    fn ensure_open(&self) -> Result<(), String> {
        if !self.is_active() || self.seq == 0 {
            return Ok(());
        }
        let mut events = load_events(
            self.conn.as_ref().ok_or("Collector store unavailable")?,
            &self.project_id,
            &self.run_id,
            self.seq,
            1,
        )?;
        let Some(kind) = events.pop().map(|event| event.event_type) else {
            return Err("Event sequence is non-empty but has no last event.".into());
        };
        if TERMINAL.contains(&kind.as_str()) {
            return Err(format!(
                "Crawl run {} is already terminal ({kind}).",
                self.run_id
            ));
        }
        Ok(())
    }

    pub fn record_started(&mut self, start_url: &str, config: &Value) -> Result<(), String> {
        self.ensure_open()?;
        if self.seq > 0 {
            return Ok(());
        }
        self.append("crawl:started", json!({"id": self.run_id, "runId": self.run_id, "projectId": self.project_id, "startUrl": start_url, "startedAt": self.started_at, "config": config, "provenance": "live-crawl"}))
    }

    pub fn record_page(&mut self, page: &CrawledPageSummary) -> Result<(), String> {
        let mut payload = serde_json::to_value(page).map_err(|e| e.to_string())?;
        if let Some(object) = payload.as_object_mut() {
            object.insert("runId".into(), json!(self.run_id));
            object.insert("projectId".into(), json!(self.project_id));
            object.insert("provenance".into(), json!("live-crawl"));
        }
        self.append("crawl:page", payload)
    }

    pub fn record_completed(
        &mut self,
        start_url: &str,
        page_count: usize,
        health_score: f64,
        duration_ms: u64,
    ) -> Result<(), String> {
        self.append("crawl:completed", json!({"id": self.run_id, "runId": self.run_id, "projectId": self.project_id, "startUrl": start_url, "pageCount": page_count, "health_score": health_score, "duration_ms": duration_ms, "completedAt": Utc::now().to_rfc3339(), "provenance": "live-crawl"}))
    }

    pub fn record_cancelled(
        &mut self,
        start_url: &str,
        page_count: usize,
        duration_ms: u64,
    ) -> Result<(), String> {
        self.append("crawl:cancelled", json!({"id": self.run_id, "runId": self.run_id, "projectId": self.project_id, "startUrl": start_url, "pageCount": page_count, "duration_ms": duration_ms, "cancelled": true, "provenance": "live-crawl"}))
    }

    pub fn record_timed_out(
        &mut self,
        start_url: &str,
        page_count: usize,
        duration_ms: u64,
    ) -> Result<(), String> {
        self.append("crawl:timed_out", json!({"id": self.run_id, "runId": self.run_id, "projectId": self.project_id, "startUrl": start_url, "pageCount": page_count, "duration_ms": duration_ms, "timed_out": true, "provenance": "live-crawl"}))
    }

    pub fn record_interrupted(
        &mut self,
        start_url: &str,
        page_count: usize,
        error: &str,
    ) -> Result<(), String> {
        self.append("crawl:interrupted", json!({"id": self.run_id, "runId": self.run_id, "projectId": self.project_id, "startUrl": start_url, "pageCount": page_count, "error": error, "interrupted": true, "provenance": "live-crawl"}))
    }
}
