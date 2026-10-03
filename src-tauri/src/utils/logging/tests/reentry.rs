use super::*;

#[test]
fn native_spans_track_reentry_and_unpolled_cancellation_without_claiming_success() {
    let (subscriber, records) = task_fixture();
    tracing::dispatcher::with_default(&subscriber, || {
        dispatch_with_sink(
            "inspect_url",
            || {
                let task = tracing::debug_span!("ipc::request::run");
                for _ in 0..3 {
                    let _entered = task.enter();
                }
                true
            },
            |_| Ok(()),
        );
        dispatch_with_sink(
            "crawl_site",
            || {
                let _unpolled = tracing::debug_span!("ipc::request::run");
                true
            },
            |_| Ok(()),
        );
        // Unrelated framework spans and events are ignored entirely.
        let _unrelated =
            tracing::info_span!("framework", url = "https://user:secret@example.com").entered();
        tracing::error!(secret = "never log this");
    });
    let records = records.lock().unwrap();
    assert_eq!(records.len(), 3);
    assert_eq!(records[0]["event"], "ipc_task_started");
    assert_eq!(records[1]["task_started"], true);
    assert_eq!(records[2]["task_started"], false);
    assert_ne!(records[1]["request_id"], records[2]["request_id"]);
    assert!(records.iter().all(|entry| entry.get("success").is_none()));
}
