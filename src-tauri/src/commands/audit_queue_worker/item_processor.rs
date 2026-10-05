use super::lock::queue_value;
use super::models::{QueueRun, QueueSnapshot};
use super::owner::QueueOwner;
use crate::commands::audit_queue;
use chrono::Utc;
use serde_json::json;

pub(super) async fn process_queue_item<R, F, Fut>(
    owner: &QueueOwner<R>,
    snapshot: &mut QueueSnapshot,
    run: &mut QueueRun,
    item_index: usize,
    first_error: &mut Option<String>,
    inspect: &F,
) -> Result<bool, String>
where
    R: tauri::Runtime,
    F: Fn(String, Option<String>) -> Fut,
    Fut: std::future::Future<Output = Result<crate::models::audit_data::PageAuditData, String>>,
{
    let app = &owner.app;
    let project_id = owner.project_id.as_str();
    let run_id = owner.run_id.as_str();
    let expected = queue_value(snapshot)?;
    let item_id = snapshot.items[item_index].id.clone();
    let url = snapshot.items[item_index].url.clone();
    let now = Utc::now().to_rfc3339();
    snapshot.items[item_index].status = "running".into();
    snapshot.items[item_index].attempts = Some(
        snapshot.items[item_index]
            .attempts
            .unwrap_or(0)
            .saturating_add(1),
    );
    snapshot.items[item_index].updated_at = Some(now.clone());
    snapshot.items[item_index].error = None;
    run.active_item_id = Some(item_id.clone());
    run.updated_at = now;
    snapshot.run = Some(run.clone());
    if !owner.update(&expected, || queue_value(snapshot))? {
        return Ok(false);
    }
    let expected = queue_value(snapshot)?;
    let inspected = inspect(url, run.user_agent.clone()).await;
    owner.update(&expected, || {
        match inspected {
            Ok(audit) => {
                let result = json!({
                    "runId": run_id,
                    "itemId": item_id,
                    "audit": audit,
                });
                if let Err(error) =
                    audit_queue::write_queue_result(app, project_id, run_id, &item_id, &result)
                {
                    first_error.get_or_insert(error.clone());
                    snapshot.items[item_index].status = "failed".into();
                    snapshot.items[item_index].error = Some(error);
                } else {
                    snapshot.items[item_index].status = "completed".into();
                    snapshot.items[item_index].completed_at = Some(Utc::now().to_rfc3339());
                    snapshot.items[item_index].error = None;
                }
            }
            Err(error) => {
                first_error.get_or_insert(error.clone());
                snapshot.items[item_index].status = "failed".into();
                snapshot.items[item_index].error = Some(error.chars().take(500).collect());
            }
        }
        snapshot.items[item_index].updated_at = Some(Utc::now().to_rfc3339());
        run.active_item_id = None;
        run.updated_at = Utc::now().to_rfc3339();
        run.last_error = first_error.clone();
        snapshot.run = Some(run.clone());
        queue_value(snapshot)
    })
}
