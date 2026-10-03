use super::*;

#[test]
fn every_background_diagnostic_is_serializable_and_logger_initialization_is_idempotent() {
    init();
    init();
    for kind in [
        Diagnostic::AuditQueueFailed,
        Diagnostic::ScheduledTaskFailed,
        Diagnostic::CrawlBackupRestoreFailed,
        Diagnostic::CrawlBackupCleanupFailed,
    ] {
        let entry = diagnostic_event(kind);
        let json = serde_json::to_value(&entry).unwrap();
        assert_eq!(json["route"], "native");
        assert!(json["event"].as_str().unwrap().ends_with("_failed"));
        assert!(json["level"] == "warn" || json["level"] == "error");
        assert!(json.get("error").is_none());
        diagnostic(kind);
    }
}
