use super::*;
use std::{
    future::Future,
    pin::Pin,
    task::{Context, Poll},
};

pub(super) struct ScopedFuture<F> {
    future: Option<Pin<Box<F>>>,
    subscriber: tracing::Dispatch,
}

pub(super) fn bind_future<F: Future>(future: F, subscriber: tracing::Dispatch) -> ScopedFuture<F> {
    ScopedFuture {
        future: Some(Box::pin(future)),
        subscriber,
    }
}

impl<F: Future> Future for ScopedFuture<F> {
    type Output = F::Output;
    fn poll(self: Pin<&mut Self>, context: &mut Context<'_>) -> Poll<Self::Output> {
        let this = self.get_mut();
        let _default = tracing::dispatcher::set_default(&this.subscriber);
        this.future.as_mut().unwrap().as_mut().poll(context)
    }
}

impl<F> Drop for ScopedFuture<F> {
    fn drop(&mut self) {
        // Registry closes ancestor spans using the current dispatcher. Keep the
        // fixture's dispatcher active during cancellation/drop as well as polls.
        let _default = tracing::dispatcher::set_default(&self.subscriber);
        drop(self.future.take());
    }
}

pub(super) fn task_fixture() -> (tracing::Dispatch, Arc<Mutex<Vec<serde_json::Value>>>) {
    // Match desktop startup before shared callsites can register without a
    // subscriber and cache Interest::never on an unscoped test thread.
    init();
    let records = Arc::new(Mutex::new(Vec::new()));
    let sink_records = records.clone();
    let subscriber = tracing_subscriber::registry().with(NativeTaskLayer {
        sink: Arc::new(move |entry| {
            sink_records
                .lock()
                .unwrap()
                .push(serde_json::to_value(entry).unwrap());
            Ok(())
        }),
    });
    (tracing::Dispatch::new(subscriber), records)
}
