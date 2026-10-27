use super::commands::*;
use super::erase_commands::*;
use crate::utils::test_app::StorageApp;
use serde_json::json;

#[test]
fn commands_round_trip_through_the_sqlite_file_and_validate_ids() {
    let fixture = StorageApp::new(tauri::test::mock_builder());
    let app = fixture.handle();
    let run = json!({"id": "r1", "completedAt": "2026-01-01", "startUrl": "https://e.test/",
        "result": {"pages": [{"url": "https://e.test/a"}, {"url": "https://e.test/b"}]}});
    store_save_crawl_run(app.clone(), "p1".into(), run.clone()).unwrap();
    assert_eq!(
        store_list_crawl_runs(app.clone(), "p1".into()).unwrap()[0]["pageCount"],
        2
    );
    assert_eq!(
        store_load_crawl_run(app.clone(), "p1".into(), "r1".into())
            .unwrap()
            .unwrap(),
        run
    );
    assert_eq!(
        store_load_crawl_pages(app.clone(), "p1".into(), "r1".into(), 1, 10)
            .unwrap()
            .len(),
        1
    );
    let imported = store_import_legacy_runs(
        app.clone(),
        "p1".into(),
        "ls".into(),
        vec![json!({"id": "r2", "completedAt": "2026-01-01", "startUrl": "https://e.test/", "result": {"pages": []}})],
    )
    .unwrap();
    assert_eq!(imported, 1);
    store_put_record(
        app.clone(),
        "p1".into(),
        "emb".into(),
        "k".into(),
        Some("s".into()),
        vec![1, 2],
    )
    .unwrap();
    assert_eq!(
        store_get_record(app.clone(), "p1".into(), "emb".into(), "k".into()).unwrap(),
        Some(vec![1, 2])
    );
    store_delete_crawl_run(app.clone(), "p1".into(), "r1".into()).unwrap();
    assert!(store_load_crawl_run(app.clone(), "p1".into(), "r1".into())
        .unwrap()
        .is_none());
    assert!(store_list_crawl_runs(app.clone(), "../x".into()).is_err());

    store_put_record(
        app.clone(),
        "p1".into(),
        "emb".into(),
        "z".into(),
        Some("s".into()),
        vec![9],
    )
    .unwrap();
    let report = store_forget_subject(app.clone(), "p1".into(), "s".into()).unwrap();
    assert_eq!(report.records_deleted, 2);
    assert_eq!(
        store_get_record(app.clone(), "p1".into(), "emb".into(), "z".into()).unwrap(),
        None
    );
    assert_eq!(
        store_erase_project(app.clone(), "p1".into())
            .unwrap()
            .action,
        "erase_project"
    );
    assert_eq!(store_erasure_log(app, "p1".into()).unwrap().len(), 2);
}
