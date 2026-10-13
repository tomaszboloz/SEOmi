use super::*;

#[test]
fn unknown_string_fields_are_ignored_while_known_ones_still_correlate() {
    let (subscriber, records) = task_fixture();
    let request_id = Uuid::new_v4();
    tracing::dispatcher::with_default(&subscriber, || {
        let _request = tracing::info_span!(
            "seomi.ipc",
            request_id = %request_id,
            route = "inspect_url",
            note = "https://user:pass@example.com/secret"
        )
        .entered();
        let _task = tracing::debug_span!("ipc::request::run").entered();
    });
    let records = records.lock().unwrap();
    assert_eq!(records.len(), 2);
    assert!(records
        .iter()
        .all(|entry| entry["request_id"] == request_id.to_string()
            && entry["route"] == "inspect_url"
            && !entry.to_string().contains("secret")));
}
