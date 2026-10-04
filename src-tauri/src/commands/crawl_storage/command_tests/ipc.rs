use super::*;

#[test]
fn history_and_checkpoint_ipc_preserve_command_names_camel_case_and_errors() {
    let fixture = fixture();
    let view = tauri::WebviewWindowBuilder::new(&fixture.app, "main", Default::default())
        .build()
        .unwrap();
    let runs = json!([{"id":"run"}]);
    assert_eq!(
        invoke(
            &view,
            "save_project_crawl_runs",
            json!({"projectId":"one","crawlRuns":runs})
        )
        .unwrap(),
        Value::Null
    );
    assert_eq!(
        invoke(&view, "load_project_crawl_runs", json!({"projectId":"one"})).unwrap(),
        runs
    );
    assert!(invoke(
        &view,
        "save_project_crawl_runs",
        json!({"projectId":"one","crawlRuns":{}})
    )
    .unwrap_err()
    .as_str()
    .unwrap()
    .contains("JSON array"));
    let checkpoint = json!({"runId":"run"});
    assert_eq!(
        invoke(
            &view,
            "save_project_crawl_checkpoint",
            json!({"projectId":"one","checkpoint":checkpoint})
        )
        .unwrap(),
        Value::Null
    );
    assert_eq!(
        invoke(
            &view,
            "load_project_crawl_checkpoint",
            json!({"projectId":"one"})
        )
        .unwrap(),
        checkpoint
    );
    assert_eq!(
        invoke(
            &view,
            "delete_project_crawl_checkpoint",
            json!({"projectId":"one"})
        )
        .unwrap(),
        Value::Null
    );
    assert_eq!(
        invoke(
            &view,
            "load_project_crawl_checkpoint",
            json!({"projectId":"one"})
        )
        .unwrap(),
        Value::Null
    );
}
