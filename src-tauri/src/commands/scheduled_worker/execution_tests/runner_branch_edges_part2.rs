use super::*;

#[tokio::test]
async fn removed_and_mismatched_latest_task_guards() {
    let app = fixture();
    let mut due = task("page-audit");
    due.next_run_at = "2020-01-01T00:00:00Z".into();
    store(&app, &due);
    let unregisters = Arc::new(AtomicUsize::new(0));
    let seen = unregisters.clone();
    let path = p_task(&app);
    let err = run_t(
        &app,
        move |_| {
            let _ = std::fs::remove_file(&path);
            async { Ok(Value::Null) }
        },
        ok_reg,
        move |_, _| {
            seen.fetch_add(1, Ordering::SeqCst);
            Ok(())
        },
    )
    .await
    .unwrap_err();
    assert_eq!(
        err,
        "Scheduled task manifest was removed while it was running."
    );
    assert_eq!(unregisters.load(Ordering::SeqCst), 1);

    store(&app, &due);
    let path2 = p_task(&app);
    let err2 = run_t(
        &app,
        move |_| {
            let mut changed = task("page-audit");
            changed.schedule_id = "schedule-2".into();
            write_json_atomic(
                &path2,
                &serde_json::to_value(&changed).unwrap(),
                MAX_EXECUTION_BYTES,
            )
            .unwrap();
            async { Ok(Value::Null) }
        },
        ok_reg,
        ok_unreg,
    )
    .await
    .unwrap_err();
    assert_eq!(
        err2,
        "Scheduled task manifest does not match requested schedule."
    );
}

#[tokio::test]
async fn latest_task_enabled_controls_register_or_unregister() {
    let app = fixture();
    let mut due = task("page-audit");
    due.next_run_at = "2020-01-01T00:00:00Z".into();
    store(&app, &due);
    let (unregisters, registers) = (Arc::new(AtomicUsize::new(0)), Arc::new(AtomicUsize::new(0)));
    let (unreg, reg) = (unregisters.clone(), registers.clone());
    let path3 = p_task(&app);
    assert!(run_t(
        &app,
        move |_| {
            let mut disabled = task("page-audit");
            disabled.enabled = false;
            write_json_atomic(
                &path3,
                &serde_json::to_value(&disabled).unwrap(),
                MAX_EXECUTION_BYTES,
            )
            .unwrap();
            async { Ok(Value::Null) }
        },
        move |_, _, _, _| {
            reg.fetch_add(1, Ordering::SeqCst);
            Ok(())
        },
        move |_, _| {
            unreg.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }
    )
    .await
    .is_ok());
    assert_eq!(unregisters.load(Ordering::SeqCst), 1);
    assert_eq!(registers.load(Ordering::SeqCst), 0);

    store(&app, &due);
    let reg2 = registers.clone();
    assert!(run_t(
        &app,
        |_| async { Ok(Value::Null) },
        move |_, _, _, _| {
            reg2.fetch_add(1, Ordering::SeqCst);
            Ok(())
        },
        |_, _| panic!("must not unregister")
    )
    .await
    .is_ok());
    assert_eq!(registers.load(Ordering::SeqCst), 1);
}
