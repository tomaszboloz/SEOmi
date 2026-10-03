use super::*;

#[test]
fn invalid_client_configuration_does_not_clear_existing_run_control() {
    let control = CrawlControl::new();
    control.pause("running-job");
    control
        .cancelled_runs
        .lock()
        .unwrap()
        .insert("running-job".into());
    let mut config = default_crawl_config(None);
    config.user_agent = Some("invalid\nuser-agent".into());
    let result = CrawlSetup::init(
        "https://example.test/".into(),
        None,
        None,
        Some("running-job".into()),
        None,
        Some(config),
        &control,
    );
    assert!(result.is_err());
    assert!(
        control.is_paused("running-job"),
        "failed setup must preserve an existing pause"
    );
    assert!(
        control.is_cancelled("running-job"),
        "failed setup must preserve cancellation"
    );
}

#[test]
fn successful_setup_clears_only_its_run_control() {
    let control = CrawlControl::new();
    for id in ["run-a", "run-b"] {
        control.pause(id);
        control.cancelled_runs.lock().unwrap().insert(id.into());
    }
    let setup = CrawlSetup::init(
        "https://example.test/".into(),
        None,
        None,
        Some("run-a".into()),
        None,
        None,
        &control,
    )
    .unwrap();
    assert_eq!(setup.run_id, "run-a");
    assert!(!control.is_paused("run-a") && !control.is_cancelled("run-a"));
    assert!(control.is_paused("run-b") && control.is_cancelled("run-b"));
}
