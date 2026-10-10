use super::run_controlled;
use crate::commands::seo_audit::AuditControl;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

fn assert_finished(control: &AuditControl, id: &str) {
    // An active request returns true on every cancel; a finished one queues
    // a pre-start cancellation once, then returns false for the duplicate.
    assert!(control.cancel(id));
    assert!(!control.cancel(id));
    control.finish(id);
}

#[tokio::test]
async fn cancellation_between_registration_and_waiting_is_not_lost() {
    let control = AuditControl::new();
    let notification = control.register("registered");
    assert!(control.cancel("registered"));
    tokio::time::timeout(
        std::time::Duration::from_millis(50),
        notification.notified(),
    )
    .await
    .expect("cancellation must retain a notification permit");
    control.finish("registered");
    assert_finished(&control, "registered");
}

#[tokio::test]
async fn success_and_failure_both_remove_the_active_request() {
    let control = AuditControl::new();
    assert_eq!(
        run_controlled(&control, "ok", async { Ok(42) }).await,
        Ok(42)
    );
    assert_finished(&control, "ok");
    let result =
        run_controlled::<()>(&control, "error", async { Err("transport failed".into()) }).await;
    assert_eq!(result, Err("transport failed".into()));
    assert_finished(&control, "error");
}

#[tokio::test]
async fn cancellation_releases_the_pending_operation_and_registration() {
    struct PendingGuard(Arc<AtomicBool>);
    impl Drop for PendingGuard {
        fn drop(&mut self) {
            self.0.store(true, Ordering::SeqCst);
        }
    }
    let control = AuditControl::new();
    let dropped = Arc::new(AtomicBool::new(false));
    let pending_guard = PendingGuard(Arc::clone(&dropped));
    let cancellation_control = &control;
    let operation = async move {
        let _guard = pending_guard;
        cancellation_control.cancel("cancelled");
        std::future::pending::<Result<(), String>>().await
    };
    let result = run_controlled(&control, "cancelled", operation).await;
    assert_eq!(result, Err("Audit cancelled by user.".into()));
    assert!(dropped.load(Ordering::SeqCst));
    assert_finished(&control, "cancelled");
}

#[tokio::test]
async fn dropping_the_request_future_also_removes_registration() {
    let control = AuditControl::new();
    let mut request = Box::pin(run_controlled::<()>(
        &control,
        "dropped",
        std::future::pending(),
    ));
    let mut context = std::task::Context::from_waker(std::task::Waker::noop());
    assert!(std::future::Future::poll(request.as_mut(), &mut context).is_pending());
    drop(request);
    assert_finished(&control, "dropped");
}
