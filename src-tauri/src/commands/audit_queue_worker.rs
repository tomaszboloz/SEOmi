//! Headless execution for a persisted CSV/page-audit queue.
//!
//! The foreground queue remains the source of truth for user-visible state.
//! When the desktop process is closed, the OS wake-up starts this worker. It
//! resumes only a stale run, updates the durable queue after every URL, and
//! stores each successful page audit as an individually acknowledgeable
//! result so a large queue cannot be lost in one oversized handoff file.

use super::{audit_queue, crawl_storage, scheduler};
use chrono::Utc;
use serde_json::json;
use std::fs;
use tauri::AppHandle;

mod current_state;
#[cfg(test)]
mod eligibility_contract_tests;
#[cfg(test)]
mod error_contract_tests;
mod execution;
#[cfg(test)]
mod execution_contract_tests;
mod finish;
#[cfg(test)]
mod finish_contract_tests;
mod item_processor;
mod lock;
mod models;
mod owner;
#[cfg(test)]
mod ownership_tests;
mod stop;
#[cfg(test)]
mod success_ownership_tests;
#[cfg(test)]
mod test_fixture;
#[cfg(test)]
mod tests;

#[cfg(test)]
mod model_tests;

#[cfg(test)]
mod state_tests;

#[cfg(test)]
mod launch_tests;

use item_processor::process_queue_item;
use lock::*;
use models::*;
use owner::QueueOwner;
use stop::handle_stop_requested;

/// Execute a stale queue using the production page inspector.
pub async fn run_audit_queue<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    run_id: String,
) -> Result<(), String> {
    execution::run_audit_queue_with(
        app,
        project_id,
        run_id,
        |url, user_agent| async move {
            super::seo_audit::inspect_url_headless(&url, user_agent.as_deref(), 15).await
        },
        |project_id, run_id| {
            let _ = scheduler::unregister_audit_queue_wakeup(project_id, run_id);
        },
    )
    .await
}

pub fn headless_launch_context() -> Option<(String, String)> {
    launch_context_from_args(&std::env::args().collect::<Vec<_>>())
}

fn launch_context_from_args(args: &[String]) -> Option<(String, String)> {
    scheduler::worker_launch_context(args, "--seomi-audit-queue-headless")
}
