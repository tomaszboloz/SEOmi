use super::*;

#[test]
fn task_sink_failure_and_untrusted_routes_cannot_change_execution_or_expose_inputs() {
    let records = Arc::new(Mutex::new(Vec::new()));
    let observed = records.clone();
    let subscriber = tracing_subscriber::registry().with(NativeTaskLayer {
        sink: Arc::new(move |entry| {
            observed
                .lock()
                .unwrap()
                .push(serde_json::to_value(entry).unwrap());
            Err(io::Error::other("log unavailable"))
        }),
    });
    tracing::subscriber::with_default(subscriber, || {
        assert!(!dispatch_with_sink(
            "url=https://user:password@example.com",
            || {
                let span = tracing::debug_span!("ipc::request::run");
                let _entered = span.enter();
                false
            },
            |_| Err(io::Error::other("dispatch sink unavailable"))
        ));
    });
    let records = records.lock().unwrap();
    assert_eq!(records.len(), 2);
    assert!(records.iter().all(|entry| entry["route"] == "unknown"));
    assert!(!serde_json::to_string(&*records)
        .unwrap()
        .contains("password"));
}
