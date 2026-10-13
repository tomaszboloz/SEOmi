use super::item_processor::process_queue_item;
use super::models::parse_snapshot;
use super::owner::QueueOwner;
use super::test_fixture::{audit, snapshot};
use crate::commands::audit_queue::save_project_audit_queue;
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;

#[tokio::test]
async fn an_item_is_not_started_when_the_stored_queue_changed_underneath() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    save_project_audit_queue(app.clone(), "one".into(), snapshot("run")).unwrap();
    let mut changed = snapshot("run");
    changed["items"][0]["status"] = "interrupted".into();
    let mut parsed = parse_snapshot(changed).unwrap();
    let mut run = parsed.run.clone().unwrap();
    let owner = QueueOwner {
        app,
        project_id: "one".into(),
        run_id: "run".into(),
        generation: None,
        retire: Box::new(|_, _| {}),
    };
    let mut first_error = None;
    let started = process_queue_item(
        &owner,
        &mut parsed,
        &mut run,
        0,
        &mut first_error,
        &audit_for,
    )
    .await
    .unwrap();
    assert!(!started);
    assert!(first_error.is_none());
}

fn audit_for(
    url: String,
    _agent: Option<String>,
) -> impl std::future::Future<Output = Result<crate::models::audit_data::PageAuditData, String>> {
    audit(url)
}
