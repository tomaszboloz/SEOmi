use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use tokio::sync::Notify;

pub struct AuditControl {
    active: Mutex<HashMap<String, Arc<Notify>>>,
    cancelled_before_start: Mutex<HashSet<String>>,
}

impl AuditControl {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(HashMap::new()),
            cancelled_before_start: Mutex::new(HashSet::new()),
        }
    }

    pub(crate) fn register(&self, request_id: &str) -> Arc<Notify> {
        let notify = Arc::new(Notify::new());
        if self
            .cancelled_before_start
            .lock()
            .map(|mut ids| ids.remove(request_id))
            .unwrap_or(true)
        {
            notify.notify_one();
        }
        if let Ok(mut active) = self.active.lock() {
            active.insert(request_id.to_string(), Arc::clone(&notify));
        }
        notify
    }

    pub(crate) fn cancel(&self, request_id: &str) -> bool {
        let notifier = self
            .active
            .lock()
            .ok()
            .and_then(|active| active.get(request_id).cloned());
        if let Some(notifier) = notifier {
            notifier.notify_waiters();
            return true;
        }
        self.cancelled_before_start
            .lock()
            .map(|mut ids| ids.insert(request_id.to_string()))
            .unwrap_or(false)
    }

    pub(crate) fn finish(&self, request_id: &str) {
        if let Ok(mut active) = self.active.lock() {
            active.remove(request_id);
        }
        if let Ok(mut ids) = self.cancelled_before_start.lock() {
            ids.remove(request_id);
        }
    }
}

impl Default for AuditControl {
    fn default() -> Self {
        Self::new()
    }
}
