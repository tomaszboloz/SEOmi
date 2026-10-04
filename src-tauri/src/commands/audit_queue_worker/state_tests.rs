use super::{lock::*, model_tests::snapshot, models::*};
use chrono::{DateTime, Duration, Utc};
use serde_json::json;

#[test]
fn stale_guard_has_exact_five_minute_boundary_and_rejects_invalid_dates() {
    let now = DateTime::parse_from_rfc3339("2026-01-01T00:05:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let mut run = parse_snapshot(snapshot()).unwrap().run.unwrap();
    assert!(queue_is_stale(&run, now).unwrap());
    run.updated_at = (now - Duration::seconds(299)).to_rfc3339();
    assert!(!queue_is_stale(&run, now).unwrap());
    run.updated_at = (now + Duration::seconds(1)).to_rfc3339();
    assert!(!queue_is_stale(&run, now).unwrap());
    run.updated_at = "2026-01-01T02:00:00+02:00".into();
    assert!(queue_is_stale(&run, now).unwrap());
    run.updated_at = "bad".into();
    assert_eq!(
        queue_is_stale(&run, now).unwrap_err(),
        "Saved audit queue run has an invalid update timestamp."
    );
}

#[test]
fn pending_guard_and_stop_request_distinguish_each_state_and_run_owner() {
    assert!(!queue_has_pending_items(&[]));
    for status in ["queued", "running", "interrupted", "failed", "completed"] {
        let mut value = snapshot();
        value["items"][0]["status"] = json!(status);
        let parsed = parse_snapshot(value).unwrap();
        assert_eq!(
            queue_has_pending_items(&parsed.items),
            status != "completed"
        );
    }
    let mut parsed = parse_snapshot(snapshot()).unwrap();
    assert!(!stop_requested_for_run(&parsed, "run-1"));
    parsed.run.as_mut().unwrap().stop_requested = true;
    assert!(stop_requested_for_run(&parsed, "run-1"));
    assert!(!stop_requested_for_run(&parsed, "run-2"));
    parsed.run = None;
    assert!(!stop_requested_for_run(&parsed, "run-1"));
}

#[test]
fn queue_serialization_round_trip_preserves_error_zero_and_user_agent() {
    let mut value = snapshot();
    value["items"][0]["error"] = json!("żółć");
    value["items"][0]["attempts"] = json!(0);
    value["run"]["stopRequested"] = json!(true);
    value["run"]["userAgent"] = json!("SEOmi/1");
    let parsed = parse_snapshot(value).unwrap();
    let serialized = queue_value(&parsed).unwrap();
    assert_eq!(serialized["items"][0]["error"], json!("żółć"));
    assert_eq!(serialized["items"][0]["attempts"], json!(0));
    assert_eq!(serialized["run"]["userAgent"], json!("SEOmi/1"));
    assert_eq!(serialized["run"]["stopRequested"], json!(true));
    let restored = parse_snapshot(serialized.clone()).unwrap();
    assert_eq!(queue_value(&restored).unwrap(), serialized);
}
