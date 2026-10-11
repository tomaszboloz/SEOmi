use super::*;

#[tokio::test]
async fn missing_and_mismatched_manifest_guards() {
    let app = fixture();
    let unregisters = Arc::new(AtomicUsize::new(0));
    let seen = unregisters.clone();
    let err = run_t(&app, no_run, ok_reg, move |_, _| {
        seen.fetch_add(1, Ordering::SeqCst);
        Ok(())
    })
    .await
    .unwrap_err();
    assert_eq!(err, "Scheduled task manifest was not found.");
    assert_eq!(unregisters.load(Ordering::SeqCst), 1);

    let mut mismatched = task("page-audit");
    mismatched.schedule_id = "schedule-2".into();
    write_task(&app, &mismatched);
    let err = run_t(&app, no_run, ok_reg, ok_unreg).await.unwrap_err();
    assert_eq!(
        err,
        "Scheduled task manifest does not match requested schedule."
    );
}

#[tokio::test]
async fn disabled_and_future_task_guards() {
    let app = fixture();
    let (mut disabled, mut future) = (task("page-audit"), task("page-audit"));
    disabled.enabled = false;
    store(&app, &disabled);
    let unregisters = Arc::new(AtomicUsize::new(0));
    let seen = unregisters.clone();
    assert!(run_t(&app, no_run, ok_reg, move |_, _| {
        seen.fetch_add(1, Ordering::SeqCst);
        Ok(())
    })
    .await
    .is_ok());
    assert_eq!(unregisters.load(Ordering::SeqCst), 1);

    future.next_run_at = "2099-01-01T00:00:00Z".into();
    store(&app, &future);
    assert!(run_t(&app, no_run, ok_reg, ok_unreg).await.is_ok());
}

#[tokio::test]
async fn a_directory_cannot_be_read_as_a_task_manifest() {
    let app = fixture();
    let manifest = p_task(&app);
    std::fs::create_dir_all(&manifest).unwrap();
    let error = run_t(&app, no_run, ok_reg, ok_unreg).await.unwrap_err();
    assert!(error.contains("Unable to read scheduled data:"), "{error}");
    assert!(manifest.is_dir());
}

#[tokio::test]
async fn lock_acquisition_none_exits_ok() {
    let app = fixture();
    let mut due = task("page-audit");
    due.next_run_at = "2020-01-01T00:00:00Z".into();
    store(&app, &due);
    let lock_path = app
        .project("project-1")
        .join("scheduled_execution_schedule-1.lock");
    let _guard = crate::commands::scheduled_worker::lock::acquire_scheduled_lock(&lock_path)
        .unwrap()
        .unwrap();
    assert!(run_t(&app, no_run, ok_reg, ok_unreg).await.is_ok());
}
