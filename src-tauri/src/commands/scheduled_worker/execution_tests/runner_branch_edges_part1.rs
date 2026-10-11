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
async fn create_dir_all_failure_surfaces_error() {
    let app = fixture();
    let mut due = task("page-audit");
    due.next_run_at = "2020-01-01T00:00:00Z".into();
    let p_dir = app.project("project-1");
    std::fs::create_dir_all(&p_dir).unwrap();
    let fifo = p_dir.join("scheduled_task_schedule-1.json");
    assert!(std::process::Command::new("mkfifo")
        .arg(&fifo)
        .status()
        .unwrap()
        .success());
    let task_json = serde_json::to_vec(&due).unwrap();
    let (dir_clone, fifo_clone) = (p_dir.clone(), fifo.clone());
    let writer = std::thread::spawn(move || {
        use std::io::Write;
        let mut f = std::fs::OpenOptions::new()
            .write(true)
            .open(&fifo_clone)
            .unwrap();
        f.write_all(&task_json).unwrap();
        drop(f);
        let _ = std::fs::remove_file(&fifo_clone);
        let _ = std::fs::remove_dir(&dir_clone);
        let _ = std::fs::write(&dir_clone, b"blocked");
    });
    let res = run_t(&app, |_| async { Ok(Value::Null) }, ok_reg, ok_unreg).await;
    writer.join().unwrap();
    assert!(res
        .unwrap_err()
        .contains("Unable to create scheduled task directory:"));
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
    let _guard = super::super::super::lock::acquire_scheduled_lock(&lock_path)
        .unwrap()
        .unwrap();
    assert!(run_t(&app, no_run, ok_reg, ok_unreg).await.is_ok());
}
