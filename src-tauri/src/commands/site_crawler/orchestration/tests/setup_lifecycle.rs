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

#[test]
fn setup_rejects_invalid_include_and_exclude_filters() {
    let control = CrawlControl::new();
    let mut config_inc = default_crawl_config(None);
    config_inc.include_patterns = vec!["[invalid regex".into()];
    let res_inc = CrawlSetup::init(
        "https://example.test/".into(),
        None,
        None,
        None,
        None,
        Some(config_inc),
        &control,
    );
    assert!(res_inc
        .err()
        .expect("invalid include filter")
        .contains("Invalid include filter"));

    let mut config_exc = default_crawl_config(None);
    config_exc.exclude_patterns = vec!["[invalid regex".into()];
    let res_exc = CrawlSetup::init(
        "https://example.test/".into(),
        None,
        None,
        None,
        None,
        Some(config_exc),
        &control,
    );
    assert!(res_exc
        .err()
        .expect("invalid exclude filter")
        .contains("Invalid exclude filter"));
}
