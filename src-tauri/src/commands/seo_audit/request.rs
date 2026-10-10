use super::AuditControl;
use std::future::Future;

struct RequestGuard<'a> {
    control: &'a AuditControl,
    request_id: &'a str,
}

impl Drop for RequestGuard<'_> {
    fn drop(&mut self) {
        self.control.finish(self.request_id);
    }
}

pub(super) async fn run_controlled<T>(
    control: &AuditControl,
    request_id: &str,
    operation: impl Future<Output = Result<T, String>>,
) -> Result<T, String> {
    let cancellation = control.register(request_id);
    let _guard = RequestGuard {
        control,
        request_id,
    };
    tokio::select! {
        _ = cancellation.notified() => Err("Audit cancelled by user.".into()),
        result = operation => result,
    }
}

#[cfg(test)]
#[path = "request_tests.rs"]
mod tests;
