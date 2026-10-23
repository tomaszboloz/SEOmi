use super::commands::*;
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
        vec![json!({"id": "r2"})],
    )
    .unwrap();
    assert_eq!(imported, 1);
    store_put_record(
        app.clone(),
        "p1".into(),
        "emb".into(),
        "k".into(),
        Some("s".into()),
        None,
        vec![1, 2],
    )
    .unwrap();
    assert_eq!(
        store_get_record(app.clone(), "p1".into(), "emb".into(), "k".into()).unwrap(),
        Some(vec![1, 2])
    );
    assert_eq!(
        store_list_record_keys(app.clone(), "p1".into(), "emb".into()).unwrap(),
        vec!["k"]
    );
    store_delete_record(app.clone(), "p1".into(), "emb".into(), "k".into()).unwrap();
    store_delete_crawl_run(app.clone(), "p1".into(), "r1".into()).unwrap();
    assert!(store_load_crawl_run(app.clone(), "p1".into(), "r1".into())
        .unwrap()
        .is_none());
    assert!(store_list_crawl_runs(app, "../x".into()).is_err());
}
