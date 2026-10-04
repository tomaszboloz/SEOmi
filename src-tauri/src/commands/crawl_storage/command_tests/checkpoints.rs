use super::*;

#[test]
fn checkpoint_commands_roundtrip_and_delete_only_owned_project() {
    let fixture = fixture();
    let app = fixture.handle();
    assert_eq!(
        load_project_crawl_checkpoint(app.clone(), "one".into()).unwrap(),
        Value::Null
    );
    let checkpoint = json!({"runId":"run", "frontier":["https://example.test/żółć"]});
    for id in ["one", "two"] {
        save_project_crawl_checkpoint(app.clone(), id.into(), checkpoint.clone()).unwrap();
    }
    assert_eq!(
        load_project_crawl_checkpoint(app.clone(), "one".into()).unwrap(),
        checkpoint
    );
    assert!(
        save_project_crawl_checkpoint(app.clone(), "one".into(), json!([]))
            .unwrap_err()
            .contains("JSON object")
    );
    delete_project_crawl_checkpoint(app.clone(), "one".into()).unwrap();
    delete_project_crawl_checkpoint(app.clone(), "one".into()).unwrap();
    assert_eq!(
        load_project_crawl_checkpoint(app.clone(), "one".into()).unwrap(),
        Value::Null
    );
    assert_eq!(
        load_project_crawl_checkpoint(app, "two".into()).unwrap(),
        checkpoint
    );
}

#[test]
fn checkpoint_exact_byte_limit_is_accepted_and_overflow_preserves_prior_file() {
    let fixture = fixture();
    let app = fixture.handle();
    // {"payload":""} contributes fourteen bytes independently of the payload.
    let checkpoint = json!({"payload":"x".repeat(MAX_CHECKPOINT_BYTES - 14)});
    assert_eq!(
        serde_json::to_vec(&checkpoint).unwrap().len(),
        MAX_CHECKPOINT_BYTES
    );
    save_project_crawl_checkpoint(app.clone(), "one".into(), checkpoint.clone()).unwrap();
    let mut extra = checkpoint.clone();
    extra["payload"] = Value::String("x".repeat(MAX_CHECKPOINT_BYTES - 13));
    assert!(
        save_project_crawl_checkpoint(app.clone(), "one".into(), extra)
            .unwrap_err()
            .contains("32 MiB safety limit")
    );
    assert_eq!(
        load_project_crawl_checkpoint(app, "one".into()).unwrap(),
        checkpoint
    );
}
