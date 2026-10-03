use super::event::{emit, event, NativeEvent};
use uuid::Uuid;

#[derive(Clone, Copy)]
pub enum Diagnostic {
    AuditQueueFailed,
    ScheduledTaskFailed,
    CrawlBackupRestoreFailed,
    CrawlBackupCleanupFailed,
}

pub(super) fn diagnostic_event(kind: Diagnostic) -> NativeEvent {
    let (level, name) = match kind {
        Diagnostic::AuditQueueFailed => ("error", "audit_queue_failed"),
        Diagnostic::ScheduledTaskFailed => ("error", "scheduled_task_failed"),
        Diagnostic::CrawlBackupRestoreFailed => ("warn", "crawl_backup_restore_failed"),
        Diagnostic::CrawlBackupCleanupFailed => ("warn", "crawl_backup_cleanup_failed"),
    };
    event(level, name, Uuid::new_v4(), "native")
}

pub fn diagnostic(kind: Diagnostic) {
    let _ = emit(&diagnostic_event(kind));
}
