use super::*;
use crate::commands::run_store::{
    commands::open_store,
    events::{append, StoredEvent},
};
use crate::utils::test_app::StorageApp;
use serde_json::Value;

#[test]
fn event_commands_read_list_and_close_through_the_project_store() {
    let fixture = StorageApp::new(tauri::test::mock_builder());
    let app = fixture.handle();
    let started = StoredEvent {
        seq: 1,
        kind: "started".into(),
        at_ms: 5,
        payload: Value::Null,
    };
    append(&mut open_store(&app, "p1").unwrap(), "p1", "r1", &started).unwrap();
    let open = store_list_open_crawl_event_runs(app.clone(), "p1".into()).unwrap();
    assert_eq!(open[0].run_id, "r1");
    let page = store_load_crawl_events(app.clone(), "p1".into(), "r1".into(), 0, 10).unwrap();
    assert_eq!(page.events, vec![started]);
    store_close_interrupted_crawl_events(app.clone(), "p1".into(), "r1".into(), 9).unwrap();
    assert!(store_list_open_crawl_event_runs(app.clone(), "p1".into())
        .unwrap()
        .is_empty());
    assert!(store_load_crawl_events(app.clone(), "../x".into(), "r1".into(), 0, 1).is_err());
    assert!(store_list_open_crawl_event_runs(app.clone(), "../x".into()).is_err());
    assert!(store_close_interrupted_crawl_events(app, "../x".into(), "r1".into(), 1).is_err());
}
