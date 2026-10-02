use super::commands::IPC_COMMANDS;
use std::time::Instant;
use uuid::Uuid;

#[derive(Clone)]
pub(super) struct RequestContext {
    pub(super) request_id: Uuid,
    pub(super) route: String,
}

pub(super) struct TaskContext {
    pub(super) request: RequestContext,
    pub(super) created: Instant,
    pub(super) started: Option<Instant>,
}

#[derive(Default)]
pub(super) struct RequestFields {
    pub(super) request_id: Option<Uuid>,
    pub(super) route: String,
}

impl tracing::field::Visit for RequestFields {
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        match field.name() {
            "request_id" => self.request_id = Uuid::parse_str(value).ok(),
            "route" => {
                self.route = IPC_COMMANDS
                    .iter()
                    .copied()
                    .find(|name| *name == value)
                    .unwrap_or("unknown")
                    .to_owned()
            }
            _ => {}
        }
    }
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        // Only our UUID field is rendered. Framework fields, including args,
        // URLs, errors and command names, are never formatted or collected.
        if field.name() == "request_id" {
            self.request_id = Uuid::parse_str(&format!("{value:?}")).ok();
        }
    }
}
