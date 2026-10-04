use super::super::paths::*;
use super::*;

#[test]
fn execution_and_result_exact_byte_caps_accept_and_one_extra_rejects() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    for (cap, execution) in [
        (MAX_QUEUE_RESULT_BYTES, false),
        (MAX_QUEUE_EXECUTION_BYTES, true),
    ] {
        let value = Value::String("x".repeat(cap - 2));
        if execution {
            write_queue_execution(&app, "one", "run", &value).unwrap();
        } else {
            write_queue_result(&app, "one", "run", "item", &value).unwrap();
        }
        let path = if execution {
            queue_execution_path(&app, "one", "run").unwrap()
        } else {
            queue_result_path(&app, "one", "run", "item").unwrap()
        };
        assert_eq!(fs::metadata(&path).unwrap().len(), cap as u64);
        drop(value);
        let value = Value::String("x".repeat(cap - 1));
        let error = if execution {
            write_queue_execution(&app, "one", "run", &value).unwrap_err()
        } else {
            write_queue_result(&app, "one", "run", "item", &value).unwrap_err()
        };
        assert!(error.contains("exceeds the safety limit"));
        assert_eq!(fs::metadata(&path).unwrap().len(), cap as u64);
    }
}

#[test]
fn execution_listing_caps_at_one_hundred_and_ignores_unowned_names() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let project = fixture.project("one");
    fs::create_dir_all(&project).unwrap();
    for n in 0..101 {
        fs::write(
            project.join(format!("audit_queue_execution_run{n}.json")),
            format!("{{\"id\":{n}}}"),
        )
        .unwrap();
    }
    for name in [
        "audit_queue_execution_run.lock",
        "audit_queue_execution_run.json.write.lock",
        "foreign.json",
    ] {
        fs::write(project.join(name), b"not JSON").unwrap();
    }
    let results = list_project_audit_queue_executions(app, "one".into()).unwrap();
    assert_eq!(results.len(), 100);
    assert_eq!(
        results
            .iter()
            .map(|v| v["id"].as_u64().unwrap())
            .collect::<std::collections::HashSet<_>>()
            .len(),
        100
    );
}
