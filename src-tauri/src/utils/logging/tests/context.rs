use super::*;

#[test]
fn missing_or_invalid_request_ids_do_not_create_native_task_contexts() {
    let (subscriber, records) = task_fixture();
    tracing::dispatcher::with_default(&subscriber, || {
        {
            let _request = tracing::info_span!("seomi.ipc", route = "get_config").entered();
            let _task = tracing::debug_span!("ipc::request::run").entered();
        }
        {
            let _request = tracing::info_span!(
                "seomi.ipc",
                request_id = "synthetic-secret",
                route = "get_config"
            )
            .entered();
            let _task = tracing::debug_span!("ipc::request::run").entered();
        }
        {
            let _request = tracing::info_span!("seomi.ipc", request_id = ?"synthetic-secret", route = "get_config").entered();
            let _task = tracing::debug_span!("ipc::request::run").entered();
        }
    });
    assert!(records.lock().unwrap().is_empty());
}

#[test]
fn debug_uuid_is_correlated_and_other_debug_fields_are_never_formatted() {
    struct Untrusted;
    impl std::fmt::Debug for Untrusted {
        fn fmt(&self, _: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            panic!("untrusted debug field must never be formatted")
        }
    }
    let (subscriber, records) = task_fixture();
    let request_id = Uuid::new_v4();
    tracing::dispatcher::with_default(&subscriber, || {
        let _request = tracing::info_span!("seomi.ipc", request_id = ?request_id,
            route = "inspect_url", ignored = ?Untrusted)
        .entered();
        let _task = tracing::debug_span!("ipc::request::run", ignored = ?Untrusted).entered();
    });
    let records = records.lock().unwrap();
    assert_eq!(records.len(), 2);
    assert!(records
        .iter()
        .all(|entry| entry["request_id"] == request_id.to_string()
            && entry["route"] == "inspect_url"));
}
