use super::*;
use serde_json::json;

fn directory() -> PathBuf {
    let path =
        std::env::temp_dir().join(format!("seomi-scheduled-storage-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&path).unwrap();
    path
}

#[test]
fn scheduled_json_round_trip_preserves_null_zero_and_unowned_temporary() {
    let directory = directory();
    let path = directory.join("task.json");
    let other = path.with_extension("json.tmp");
    fs::write(&other, b"other writer").unwrap();
    assert!(read_json::<Value>(&path, 100).unwrap().is_none());
    let value = json!({"zero":0,"unknown":null,"unicode":"żółć"});
    let length = serde_json::to_vec(&value).unwrap().len();
    write_json_atomic(&path, &value, length).unwrap();
    assert_eq!(
        read_json::<Value>(&path, length).unwrap(),
        Some(value.clone())
    );
    assert!(read_json::<Value>(&path, length - 1)
        .unwrap_err()
        .contains("safety limit"));
    assert!(
        write_json_atomic(&path, &json!({"larger":"x".repeat(100)}), length)
            .unwrap_err()
            .contains("safety limit")
    );
    assert_eq!(read_json::<Value>(&path, length).unwrap(), Some(value));
    assert_eq!(fs::read(&other).unwrap(), b"other writer");
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn scheduled_json_reports_parse_and_directory_errors_without_overwriting_destination() {
    let directory = directory();
    let path = directory.join("invalid.json");
    fs::write(&path, b"not json").unwrap();
    assert!(read_json::<Value>(&path, 100)
        .unwrap_err()
        .contains("Scheduled data is invalid"));
    let destination = directory.join("is-directory.json");
    fs::create_dir(&destination).unwrap();
    assert!(write_json_atomic(&destination, &json!({}), 100)
        .unwrap_err()
        .contains("finalize file"));
    assert!(read_json::<Value>(&destination, 100).is_err());
    assert_eq!(fs::read_dir(&directory).unwrap().count(), 2);
    let blocked_parent = path.join("data.json");
    assert!(write_json_atomic(&blocked_parent, &json!({}), 100)
        .unwrap_err()
        .contains("create scheduled task directory"));
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn concurrent_scheduled_writes_commit_complete_json_records() {
    let directory = directory();
    let path = directory.join("result.json");
    let barrier = std::sync::Arc::new(std::sync::Barrier::new(12));
    let tasks: Vec<_> = (0..12)
        .map(|writer| {
            let path = path.clone();
            let barrier = barrier.clone();
            std::thread::spawn(move || {
                barrier.wait();
                write_json_atomic(
                    &path,
                    &json!({"writer":writer,"payload":"x".repeat(1000)}),
                    2000,
                )
            })
        })
        .collect();
    for task in tasks {
        task.join().unwrap().unwrap();
    }
    let value = read_json::<Value>(&path, 2000).unwrap().unwrap();
    assert!(value["writer"].as_u64().unwrap() < 12);
    assert_eq!(value["payload"].as_str().unwrap().len(), 1000);
    assert_eq!(fs::read_dir(&directory).unwrap().count(), 1);
    fs::remove_dir_all(directory).unwrap();
}
