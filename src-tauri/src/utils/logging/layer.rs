use super::{
    context::{RequestContext, RequestFields, TaskContext},
    event::{event, NativeEvent},
};
use std::{io, sync::Arc, time::Instant};
use tracing::{
    span::{Attributes, Id},
    Subscriber,
};
use tracing_subscriber::{layer::Context, registry::LookupSpan, Layer};

type EventSink = Arc<dyn Fn(&NativeEvent) -> io::Result<()> + Send + Sync>;
pub(super) struct NativeTaskLayer {
    pub(super) sink: EventSink,
}

impl<S> Layer<S> for NativeTaskLayer
where
    S: Subscriber + for<'lookup> LookupSpan<'lookup>,
{
    fn on_new_span(&self, attributes: &Attributes<'_>, id: &Id, context: Context<'_, S>) {
        let Some(span) = context.span(id) else {
            return;
        };
        if attributes.metadata().name() == "seomi.ipc" {
            let mut fields = RequestFields::default();
            attributes.record(&mut fields);
            if let Some(request_id) = fields.request_id {
                span.extensions_mut().insert(RequestContext {
                    request_id,
                    route: fields.route,
                });
            }
        } else if attributes.metadata().name() == "ipc::request::run" {
            let request = span
                .scope()
                .skip(1)
                .find_map(|ancestor| ancestor.extensions().get::<RequestContext>().cloned());
            if let Some(request) = request {
                span.extensions_mut().insert(TaskContext {
                    request,
                    created: Instant::now(),
                    started: None,
                });
            }
        }
    }

    fn on_enter(&self, id: &Id, context: Context<'_, S>) {
        let Some(span) = context.span(id) else {
            return;
        };
        let request = {
            let mut extensions = span.extensions_mut();
            let Some(task) = extensions.get_mut::<TaskContext>() else {
                return;
            };
            if task.started.is_some() {
                return;
            }
            task.started = Some(Instant::now());
            task.request.clone()
        };
        let _ = (self.sink)(&event(
            "info",
            "ipc_task_started",
            request.request_id,
            &request.route,
        ));
    }

    fn on_close(&self, id: Id, context: Context<'_, S>) {
        let Some(span) = context.span(&id) else {
            return;
        };
        let extensions = span.extensions();
        let Some(task) = extensions.get::<TaskContext>() else {
            return;
        };
        let mut closed = event(
            "info",
            "ipc_task_closed",
            task.request.request_id,
            &task.request.route,
        );
        closed.task_duration_ms = Some(task.started.unwrap_or(task.created).elapsed().as_millis());
        closed.task_started = Some(task.started.is_some());
        let _ = (self.sink)(&closed);
    }
}
