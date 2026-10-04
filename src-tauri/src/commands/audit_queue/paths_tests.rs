use super::*;
use serde_json::json;

fn directory() -> PathBuf {
    let path = std::env::temp_dir().join(format!("seomi-queue-test-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&path).unwrap();
    path
}

#[test]
fn atomic_queue_write_preserves_unowned_temporary_file() {
    let directory = directory();
    let path = directory.join("queue.json");
    let existing_temporary = path.with_extension("json.tmp");
    fs::write(&existing_temporary, b"another writer's data").unwrap();
    write_atomic(&path, &json!({"owner":"this writer"})).unwrap();
    assert_eq!(
        fs::read(&existing_temporary).unwrap(),
        b"another writer's data"
    );
    assert_eq!(
        serde_json::from_slice::<Value>(&fs::read(&path).unwrap()).unwrap(),
        json!({"owner":"this writer"})
    );
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn queue_writer_accepts_exact_limit_and_preserves_previous_file_on_oversize() {
    let directory = directory();
    let path = directory.join("queue.json");
    let value = Value::String("a".repeat(MAX_QUEUE_BYTES - 2));
    assert_eq!(serde_json::to_vec(&value).unwrap().len(), MAX_QUEUE_BYTES);
    write_atomic(&path, &value).unwrap();
    assert_eq!(fs::metadata(&path).unwrap().len(), MAX_QUEUE_BYTES as u64);
    let oversized = Value::String("b".repeat(MAX_QUEUE_BYTES - 1));
    assert!(write_atomic(&path, &oversized)
        .unwrap_err()
        .contains("safety limit"));
    assert_eq!(
        serde_json::from_slice::<Value>(&fs::read(&path).unwrap()).unwrap(),
        value
    );
    assert!(path.with_extension("json.write.lock").is_file());
    assert_eq!(fs::read_dir(&directory).unwrap().count(), 2);
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn failed_destination_replace_cleans_only_owned_temporary_file() {
    let directory = directory();
    let path = directory.join("destination.json");
    fs::create_dir(&path).unwrap();
    let error = write_atomic(&path, &json!({"value":1})).unwrap_err();
    assert!(error.contains("Unable to finalize file"));
    assert!(path.is_dir());
    assert!(path.with_extension("json.write.lock").is_file());
    assert_eq!(fs::read_dir(&directory).unwrap().count(), 2);
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn parallel_queue_writers_commit_complete_json_without_temporary_collisions() {
    let directory = directory();
    let path = directory.join("queue.json");
    let barrier = std::sync::Arc::new(std::sync::Barrier::new(16));
    let tasks: Vec<_> = (0..16)
        .map(|writer| {
            let path = path.clone();
            let barrier = barrier.clone();
            std::thread::spawn(move || {
                barrier.wait();
                write_atomic(&path, &json!({"writer":writer,"text":"x".repeat(10_000)}))
            })
        })
        .collect();
    for task in tasks {
        task.join().unwrap().unwrap();
    }
    let value: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    assert!(value["writer"].as_u64().unwrap() < 16);
    assert_eq!(value["text"].as_str().unwrap().len(), 10_000);
    assert!(path.with_extension("json.write.lock").is_file());
    assert_eq!(fs::read_dir(&directory).unwrap().count(), 2);
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn execution_limit_accepts_data_above_queue_limit_without_weakening_result_limit() {
    let directory = directory();
    let path = directory.join("execution.json");
    let value = Value::String("a".repeat(MAX_QUEUE_BYTES));
    write_atomic_with_limit(&path, &value, MAX_QUEUE_EXECUTION_BYTES).unwrap();
    assert_eq!(
        fs::metadata(&path).unwrap().len(),
        MAX_QUEUE_BYTES as u64 + 2
    );
    let error = write_atomic_with_limit(&path, &value, MAX_QUEUE_RESULT_BYTES).unwrap_err();
    assert!(error.contains("safety limit"));
    assert_eq!(
        fs::metadata(&path).unwrap().len(),
        MAX_QUEUE_BYTES as u64 + 2
    );
    fs::remove_dir_all(directory).unwrap();
}
