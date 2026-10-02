use super::super::{commands::IPC_COMMANDS, formatting::valid_event};
use super::*;

#[test]
fn structured_log_target_cannot_smuggle_untrusted_route_event_or_level() {
    for field in ["route", "event", "level"] {
        let mut entry =
            serde_json::to_value(event("info", "ipc_received", Uuid::new_v4(), "get_config"))
                .unwrap();
        entry[field] = serde_json::json!("synthetic-secret https://user:pass@example.com");
        let raw = entry.to_string();
        let formatted = format_record(
            &log::Record::builder()
                .target("seomi::event")
                .args(format_args!("{raw}"))
                .build(),
        );
        assert!(
            !formatted.contains("synthetic-secret"),
            "untrusted {field} leaked"
        );
        let safe: serde_json::Value = serde_json::from_str(&formatted).unwrap();
        assert_eq!(safe["event"], "framework_diagnostic");
    }
}

#[test]
fn event_validation_preserves_each_supported_route_level_and_diagnostic() {
    for route in IPC_COMMANDS.iter().copied().chain(["native", "unknown"]) {
        for level in ["info", "warn", "error"] {
            for name in [
                "ipc_received",
                "ipc_dispatched",
                "ipc_task_started",
                "ipc_task_closed",
                "audit_queue_failed",
                "scheduled_task_failed",
                "crawl_backup_restore_failed",
                "crawl_backup_cleanup_failed",
                "framework_diagnostic",
            ] {
                assert!(valid_event(&event(level, name, Uuid::new_v4(), route)));
            }
        }
    }
    for entry in [
        event("debug", "ipc_received", Uuid::new_v4(), "get_config"),
        event("info", "invented", Uuid::new_v4(), "get_config"),
        event("info", "ipc_received", Uuid::new_v4(), ""),
    ] {
        assert!(!valid_event(&entry));
    }
}

#[test]
fn malformed_structured_records_cannot_forward_unknown_fields_or_invalid_ids() {
    for field in ["extra", "request_id", "accepted", "timestamp_ms"] {
        let mut entry =
            serde_json::to_value(event("info", "ipc_received", Uuid::new_v4(), "get_config"))
                .unwrap();
        entry[field] = serde_json::json!("synthetic-secret");
        let raw = entry.to_string();
        let formatted = format_record(
            &log::Record::builder()
                .target("seomi::event")
                .args(format_args!("{raw}"))
                .build(),
        );
        assert!(!formatted.contains("synthetic-secret"));
        let safe: serde_json::Value = serde_json::from_str(&formatted).unwrap();
        assert_eq!(safe["event"], "framework_diagnostic");
    }
}
