use chrono::Utc;
use rusqlite::Connection;
use serde_json::json;

use crate::commands::run_store::events::{append_events, StoredCrawlEvent};
use crate::commands::site_crawler::models::CrawledPageSummary;

pub struct NativeCrawlCollector {
    pub project_id: String,
    pub run_id: String,
    pub seq: i64,
    pub conn: Option<Connection>,
}

impl NativeCrawlCollector {
    pub fn new(project_id: Option<String>, run_id: String, conn: Option<Connection>) -> Self {
        Self {
            project_id: project_id.unwrap_or_default(),
            run_id,
            seq: 0,
            conn,
        }
    }

    pub fn is_active(&self) -> bool {
        self.conn.is_some() && !self.project_id.trim().is_empty()
    }

    fn append_single(
        &mut self,
        event_type: &str,
        payload: serde_json::Value,
    ) -> Result<(), String> {
        if !self.is_active() {
            return Ok(());
        }
        let next_seq = self.seq + 1;
        let event = StoredCrawlEvent {
            project_id: self.project_id.clone(),
            run_id: self.run_id.clone(),
            seq: next_seq,
            event_type: event_type.to_string(),
            at: Utc::now().to_rfc3339(),
            payload,
        };
        let conn = self.conn.as_mut().ok_or("Collector store unavailable")?;
        append_events(conn, &self.project_id, &self.run_id, &[event])?;
        self.seq = next_seq;
        Ok(())
    }

    pub fn record_started(
        &mut self,
        start_url: &str,
        config: &serde_json::Value,
    ) -> Result<(), String> {
        self.append_single(
            "crawl:started",
            json!({
                "id": self.run_id,
                "startUrl": start_url,
                "config": config,
                "provenance": "live-crawl"
            }),
        )
    }

    pub fn record_page(&mut self, page: &CrawledPageSummary) -> Result<(), String> {
        let mut val = serde_json::to_value(page).map_err(|e| e.to_string())?;
        if let Some(obj) = val.as_object_mut() {
            obj.insert("provenance".to_string(), json!("live-crawl"));
        }
        self.append_single("crawl:page", val)
    }

    pub fn record_completed(
        &mut self,
        start_url: &str,
        page_count: usize,
        health_score: f64,
        duration_ms: u64,
    ) -> Result<(), String> {
        self.append_single(
            "crawl:completed",
            json!({
                "id": self.run_id,
                "startUrl": start_url,
                "pageCount": page_count,
                "health_score": health_score,
                "duration_ms": duration_ms,
                "provenance": "live-crawl"
            }),
        )
    }

    pub fn record_cancelled(
        &mut self,
        start_url: &str,
        page_count: usize,
        duration_ms: u64,
    ) -> Result<(), String> {
        self.append_single(
            "crawl:cancelled",
            json!({
                "id": self.run_id,
                "startUrl": start_url,
                "pageCount": page_count,
                "duration_ms": duration_ms,
                "cancelled": true,
                "provenance": "live-crawl"
            }),
        )
    }

    pub fn record_timed_out(
        &mut self,
        start_url: &str,
        page_count: usize,
        duration_ms: u64,
    ) -> Result<(), String> {
        self.append_single(
            "crawl:timed_out",
            json!({
                "id": self.run_id,
                "startUrl": start_url,
                "pageCount": page_count,
                "duration_ms": duration_ms,
                "timed_out": true,
                "provenance": "live-crawl"
            }),
        )
    }
}
