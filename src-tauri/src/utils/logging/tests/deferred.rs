use super::*;

#[tokio::test]
async fn async_span_retains_dispatch_id_until_the_deferred_native_future_settles() {
    let (subscriber, records) = task_fixture();
    let mut task_span = None;
    tracing::dispatcher::with_default(&subscriber, || {
        assert!(dispatch_with_sink(
            "get_secret",
            || {
                task_span = Some(tracing::debug_span!(
                    "ipc::request::run",
                    ignored = "token=secret"
                ));
                true
            },
            |entry| {
                records
                    .lock()
                    .unwrap()
                    .push(serde_json::to_value(entry).unwrap());
                Ok(())
            }
        ));
    });
    assert_eq!(records.lock().unwrap().len(), 2);
    let (release, deferred) = tokio::sync::oneshot::channel::<()>();
    let task = tokio::spawn(bind_future(
        async move {
            deferred.await.unwrap();
            Err::<(), _>("private result is preserved")
        }
        .instrument(task_span.take().unwrap()),
        subscriber,
    ));
    tokio::task::yield_now().await;
    assert_eq!(records.lock().unwrap().len(), 3);
    release.send(()).unwrap();
    assert_eq!(task.await.unwrap(), Err("private result is preserved"));
    let records = records.lock().unwrap();
    assert_eq!(records.len(), 4);
    assert_eq!(records[2]["event"], "ipc_task_started");
    assert_eq!(records[3]["event"], "ipc_task_closed");
    assert_eq!(records[3]["task_started"], true);
    assert!(records[3]["task_duration_ms"].is_number());
    assert!(records
        .iter()
        .all(|entry| entry["request_id"] == records[0]["request_id"]
            && entry["route"] == "get_secret"));
    let json = serde_json::to_string(&*records).unwrap();
    assert!(!json.contains("token=secret") && !json.contains("private result"));
}
