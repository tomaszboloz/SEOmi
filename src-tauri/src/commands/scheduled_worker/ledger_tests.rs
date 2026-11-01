use super::*;
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::test::mock_builder;

fn app() -> StorageApp {
    StorageApp::new(mock_builder().invoke_handler(tauri::generate_handler![
        reserve_monitoring_alert,
        finish_monitoring_alert,
        list_monitoring_ledger
    ]))
}
fn at(text: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(text)
        .unwrap()
        .with_timezone(&Utc)
}
const NOW: &str = "2026-10-10T12:00:00Z";

fn entry(fingerprint: &str, kind: &str, when: &str) -> LedgerEntry {
    LedgerEntry {
        fingerprint: fingerprint.into(),
        alert_type: kind.into(),
        occurred_at: when.into(),
    }
}

#[test]
fn reserve_then_finish_persists_once_and_blocks_in_flight_repeats() {
    let app = app();
    let handle = app.handle();
    let id = ("ledger-a", "fp-1", "crawl", "daily");
    assert!(!reserve_at(&handle, id, at(NOW)).unwrap());
    assert!(reserve_at(&handle, id, at(NOW)).unwrap(), "in flight");
    assert!(
        reserve_at(&handle, ("ledger-a", "fp-2", "crawl", "daily"), at(NOW)).unwrap(),
        "same type in flight"
    );
    assert!(finish_at(&handle, id, Some(NOW)).unwrap());
    assert!(finish_at(&handle, id, Some(NOW)).unwrap(), "idempotent");
    assert!(reserve_at(&handle, id, at(NOW)).unwrap(), "delivered");
    assert!(
        reserve_at(&handle, ("ledger-a", "fp-3", "crawl", "daily"), at(NOW)).unwrap(),
        "daily window"
    );
    assert!(!reserve_at(&handle, ("ledger-a", "fp-3", "gsc", "daily"), at(NOW)).unwrap());
    assert!(
        !finish_at(&handle, ("ledger-a", "fp-3", "gsc", "daily"), None).unwrap(),
        "failed delivery is not saved"
    );
    assert!(
        !reserve_at(&handle, ("ledger-a", "fp-3", "gsc", "daily"), at(NOW)).unwrap(),
        "retry allowed"
    );
    finish_at(&handle, ("ledger-a", "fp-3", "gsc", "daily"), None).unwrap();
    assert!(
        !reserve_at(&handle, ("ledger-b", "fp-1", "crawl", "daily"), at(NOW)).unwrap(),
        "other project"
    );
    finish_at(&handle, ("ledger-b", "fp-1", "crawl", "daily"), None).unwrap();
    assert_eq!(
        read(&handle, "ledger-a").unwrap(),
        vec![entry("fp-1", "crawl", NOW)]
    );
}

#[test]
fn the_ledger_is_bounded_and_rejects_invalid_input() {
    let app = app();
    let handle = app.handle();
    for i in 0..LEDGER_LIMIT + 3 {
        let fp = format!("fp-{i}");
        assert!(!reserve_at(&handle, ("ledger-c", &fp, "aio", "run"), at(NOW)).unwrap());
        finish_at(&handle, ("ledger-c", &fp, "aio", "run"), Some(NOW)).unwrap();
    }
    let kept = read(&handle, "ledger-c").unwrap();
    assert_eq!(
        (kept.len(), kept[0].fingerprint.as_str()),
        (LEDGER_LIMIT, "fp-3")
    );
    for bad in [
        ("../x", "f", "crawl", "run"),
        ("p", "", "crawl", "run"),
        ("p", "f", "other", "run"),
        ("p", "f", "crawl", "hourly"),
    ] {
        assert!(reserve_at(&handle, bad, at(NOW)).is_err(), "{bad:?}");
        assert!(finish_at(&handle, bad, Some(NOW)).is_err(), "{bad:?}");
    }
    assert!(finish_at(&handle, ("p", &"x".repeat(513), "crawl", "run"), Some(NOW)).is_err());
    assert!(finish_at(
        &handle,
        ("ledger-c", "late", "crawl", "run"),
        Some("yesterday")
    )
    .is_err());
}

#[test]
fn registered_commands_accept_frontend_payloads() {
    let app = app();
    let view = tauri::WebviewWindowBuilder::new(&app.app, "main", Default::default())
        .build()
        .unwrap();
    let body =
        json!({"projectId":"ledger-d","fingerprint":"fp","alertType":"semantic","frequency":"run"});
    assert_eq!(
        invoke(&view, "reserve_monitoring_alert", body.clone()).unwrap(),
        json!(false)
    );
    let mut done = body;
    done["occurredAt"] = json!(NOW);
    assert_eq!(
        invoke(&view, "finish_monitoring_alert", done).unwrap(),
        json!(true)
    );
    let list = invoke(
        &view,
        "list_monitoring_ledger",
        json!({"projectId":"ledger-d"}),
    )
    .unwrap();
    assert_eq!(
        list,
        json!([{"fingerprint":"fp","alertType":"semantic","occurredAt":NOW}])
    );
    assert!(invoke(&view, "list_monitoring_ledger", json!({"projectId":"../x"})).is_err());
    assert_eq!(
        invoke(
            &view,
            "list_monitoring_ledger",
            json!({"projectId":"ledger-empty"})
        )
        .unwrap(),
        json!([])
    );
}
