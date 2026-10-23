use super::commands::{open_store, store_put_record};
use crate::utils::test_app::StorageApp;
use rusqlite::Connection;
use std::fs;

#[test]
fn open_store_reports_an_uncreatable_data_folder() {
    let fixture = StorageApp::new(tauri::test::mock_builder());
    fs::write(&fixture.root, b"not a folder").unwrap();
    let error = open_store(&fixture.handle(), "p1").unwrap_err();
    fs::remove_file(&fixture.root).unwrap();
    assert!(
        error.starts_with("Unable to create data folder:"),
        "{error}"
    );
}

#[test]
fn open_store_reports_an_unopenable_database_file() {
    let fixture = StorageApp::new(tauri::test::mock_builder());
    fs::create_dir_all(fixture.root.join("seomi_store.sqlite3")).unwrap();
    let error = open_store(&fixture.handle(), "p1").unwrap_err();
    assert!(error.starts_with("Unable to open store:"), "{error}");
}

#[test]
fn plain_put_record_surfaces_store_errors() {
    let fixture = StorageApp::new(tauri::test::mock_builder());
    drop(open_store(&fixture.handle(), "p1").unwrap());
    let conn = Connection::open(fixture.root.join("seomi_store.sqlite3")).unwrap();
    conn.execute_batch(
        "CREATE TRIGGER deny BEFORE INSERT ON records \
         BEGIN SELECT RAISE(ABORT, 'denied'); END;",
    )
    .unwrap();
    drop(conn);
    let result = store_put_record(
        fixture.handle(),
        "p1".into(),
        "k".into(),
        "a".into(),
        None,
        vec![1],
    );
    let error = result.unwrap_err();
    assert!(
        error.starts_with("Store error:") && error.contains("denied"),
        "{error}"
    );
}
