use super::*;

#[tokio::test]
async fn cancelling_a_polled_future_closes_its_native_span() {
    let (subscriber, records) = task_fixture();
    let mut span = None;
    tracing::dispatcher::with_default(&subscriber, || {
        dispatch_with_sink(
            "run_ai_cli",
            || {
                span = Some(tracing::debug_span!("ipc::request::run"));
                true
            },
            |_| Ok(()),
        );
    });
    let (entered, ready) = tokio::sync::oneshot::channel();
    let task = tokio::spawn(bind_future(
        async move {
            entered.send(()).unwrap();
            std::future::pending::<()>().await;
        }
        .instrument(span.unwrap()),
        subscriber,
    ));
    ready.await.unwrap();
    task.abort();
    assert!(task.await.unwrap_err().is_cancelled());
    let records = records.lock().unwrap();
    assert_eq!(records.len(), 2);
    assert_eq!(records[1]["event"], "ipc_task_closed");
    assert_eq!(records[1]["task_started"], true);
    assert_eq!(records[0]["request_id"], records[1]["request_id"]);
}
