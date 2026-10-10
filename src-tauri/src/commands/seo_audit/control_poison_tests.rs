use super::AuditControl;
use std::sync::Arc;
use tokio::time::{timeout, Duration};

#[tokio::test]
async fn poisoned_pending_cancellation_fails_closed_on_registration() {
    let control = Arc::new(AuditControl::new());
    let owner = Arc::clone(&control);
    assert!(std::thread::spawn(move || {
        let _guard = owner.cancelled_before_start.lock().unwrap();
        panic!("intentional pending cancellation lock poison");
    })
    .join()
    .is_err());
    assert!(!control.cancel("new-request"));
    let notify = control.register("new-request");
    timeout(Duration::from_millis(50), notify.notified())
        .await
        .expect("poisoned cancellation state must cancel registration");
    control.finish("new-request");
    assert!(control.active.lock().unwrap().is_empty());
}

#[tokio::test]
async fn poisoned_active_registry_retains_cancellation_for_next_registration() {
    let control = Arc::new(AuditControl::new());
    let owner = Arc::clone(&control);
    assert!(std::thread::spawn(move || {
        let _guard = owner.active.lock().unwrap();
        panic!("intentional active registry lock poison");
    })
    .join()
    .is_err());
    assert!(control.cancel("pending-request"));
    let notify = control.register("pending-request");
    timeout(Duration::from_millis(50), notify.notified())
        .await
        .expect("pending cancellation must survive unavailable active registry");
    control.finish("pending-request");
    assert!(control.cancelled_before_start.lock().unwrap().is_empty());
}

#[tokio::test]
async fn default_audit_control_handles_pre_cancellation() {
    let control = AuditControl::default();
    assert!(control.cancel("pre-cancel"));
    let notify = control.register("pre-cancel");
    timeout(Duration::from_millis(50), notify.notified())
        .await
        .expect("pre-cancelled request must be notified immediately");
    control.finish("pre-cancel");
}
