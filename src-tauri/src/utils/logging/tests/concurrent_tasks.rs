use super::*;

#[test]
fn concurrent_native_spans_keep_their_own_request_contexts() {
    let (subscriber, records) = task_fixture();
    let threads: Vec<_> = (0..16)
        .map(|_| {
            let subscriber = subscriber.clone();
            std::thread::spawn(move || {
                tracing::dispatcher::with_default(&subscriber, || {
                    dispatch_with_sink(
                        "get_config",
                        || {
                            let span = tracing::debug_span!("ipc::request::run");
                            let _entered = span.enter();
                            true
                        },
                        |_| Ok(()),
                    );
                })
            })
        })
        .collect();
    for thread in threads {
        thread.join().unwrap();
    }
    let records = records.lock().unwrap();
    assert_eq!(records.len(), 32);
    let ids: std::collections::HashSet<_> = records
        .iter()
        .map(|entry| entry["request_id"].as_str().unwrap())
        .collect();
    assert_eq!(ids.len(), 16);
    for id in ids {
        let pair: Vec<_> = records
            .iter()
            .filter(|entry| entry["request_id"] == id)
            .collect();
        assert_eq!(pair.len(), 2);
        assert_eq!(pair[0]["event"], "ipc_task_started");
        assert_eq!(pair[1]["event"], "ipc_task_closed");
    }
}
