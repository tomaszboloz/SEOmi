use super::models::*;
use serde_json::{json, Value};

pub(super) fn snapshot() -> Value {
    json!({"items":[{"id":"item-1","url":"https://example.test","status":"queued"}],
        "run":{"id":"run-1","status":"running","startedAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}})
}

#[test]
fn queue_identifiers_accept_only_ascii_with_exact_length_cap() {
    for value in ["a", "Az09_-", &"x".repeat(80)] {
        assert!(valid_identifier(value));
    }
    for value in ["", "../", "ż", "a b", &"x".repeat(81)] {
        assert!(!valid_identifier(value));
    }
}

#[test]
fn snapshot_preserves_defaults_optional_values_and_all_supported_statuses() {
    for item_status in ["queued", "running", "interrupted", "completed", "failed"] {
        for run_status in ["running", "interrupted", "stopped", "completed"] {
            let mut value = snapshot();
            value["items"][0]["status"] = json!(item_status);
            value["run"]["status"] = json!(run_status);
            let parsed = parse_snapshot(value).unwrap();
            assert_eq!(parsed.items[0].status, item_status);
            assert!(parsed.items[0].error.is_none());
            assert!(parsed.items[0].attempts.is_none());
            let run = parsed.run.unwrap();
            assert_eq!(run.status, run_status);
            assert!(!run.stop_requested);
            assert!(run.user_agent.is_none());
        }
    }
    let parsed = parse_snapshot(json!({"items":[]})).unwrap();
    assert!(parsed.run.is_none());
    assert!(parsed.items.is_empty());
}

#[test]
fn snapshot_rejects_malformed_schema_items_and_run_fields() {
    for value in [Value::Null, json!([]), json!({}), json!({"items":"bad"})] {
        assert!(parse_snapshot(value)
            .unwrap_err()
            .starts_with("Saved audit queue is invalid:"));
    }
    for (key, bad) in [("id", "../"), ("url", " \t"), ("status", "other")] {
        let mut value = snapshot();
        value["items"][0][key] = json!(bad);
        assert_eq!(
            parse_snapshot(value).unwrap_err(),
            "Saved audit queue contains an invalid item."
        );
    }
    for (key, bad) in [("id", "../"), ("status", "failed")] {
        let mut value = snapshot();
        value["run"][key] = json!(bad);
        assert_eq!(
            parse_snapshot(value).unwrap_err(),
            "Saved audit queue contains an invalid run."
        );
    }
    let mut value = snapshot();
    value["run"]["updatedAt"] = json!("bad");
    assert_eq!(
        parse_snapshot(value).unwrap_err(),
        "Saved audit queue run has an invalid update timestamp."
    );
}

#[test]
fn snapshot_accepts_exact_item_cap_and_rejects_one_more() {
    let item = snapshot()["items"][0].clone();
    let mut items: Vec<_> = (0..MAX_QUEUE_ITEMS)
        .map(|index| {
            let mut item = item.clone();
            item["id"] = json!(format!("item-{index}"));
            item
        })
        .collect();
    assert_eq!(
        parse_snapshot(json!({"items":items})).unwrap().items.len(),
        MAX_QUEUE_ITEMS
    );
    items.push(item);
    assert_eq!(
        parse_snapshot(json!({"items":items})).unwrap_err(),
        "Saved audit queue exceeds the item safety limit."
    );
}
