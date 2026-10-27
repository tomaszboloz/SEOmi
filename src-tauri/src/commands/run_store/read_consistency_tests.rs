use super::{runs, schema};
use serde_json::{json, Value};
use std::{fs, sync::Arc};

fn run(id: &str, start_url: &str, page_url: &str) -> Value {
    json!({"id": id, "completedAt": "2026-10-23", "startUrl": start_url,
        "result": {"pages": [{"url": page_url}]}})
}

#[test]
fn load_run_keeps_metadata_and_pages_from_one_snapshot() {
    let dir = std::env::temp_dir().join(format!("seomi-read-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&dir).unwrap();
    let path = Arc::new(dir.join("store.sqlite3"));
    let old = run("r", "https://old.test/", "https://old.test/page");
    let new = run("r", "https://new.test/", "https://new.test/page");
    let mut seed = schema::open(path.as_ref()).unwrap();
    runs::save_run(&mut seed, "p", &old).unwrap();
    drop(seed);

    let reader = schema::open(path.as_ref()).unwrap();
    let mut writer = schema::open(path.as_ref()).unwrap();
    let loaded = runs::load_run_after_meta(&reader, "p", "r", || {
        runs::replace_runs(&mut writer, "p", std::slice::from_ref(&new))
    })
    .unwrap()
    .unwrap();

    assert_eq!(loaded, old);
    drop(writer);
    drop(reader);
    fs::remove_dir_all(dir).unwrap();
}
