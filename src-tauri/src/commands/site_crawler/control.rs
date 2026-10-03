use super::*;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CrawlProgress {
    pub run_id: String,
    pub current_url: Option<String>,
    pub discovered: usize,
    pub completed: usize,
    pub queued: usize,
    pub cancelled: bool,
    pub paused: bool,
    pub elapsed_ms: u64,
    pub pages_per_second: f64,
}

#[derive(Default)]
pub struct CrawlControl {
    pub(super) cancelled_runs: Mutex<HashSet<String>>,
    pub(super) paused_runs: Mutex<HashSet<String>>,
}

impl CrawlControl {
    pub fn new() -> Self {
        Self {
            cancelled_runs: Mutex::new(HashSet::new()),
            paused_runs: Mutex::new(HashSet::new()),
        }
    }

    pub(super) fn is_cancelled(&self, run_id: &str) -> bool {
        self.cancelled_runs
            .lock()
            .map(|runs| runs.contains(run_id))
            .unwrap_or(true)
    }

    pub(super) fn start(&self, run_id: &str) {
        if let Ok(mut runs) = self.cancelled_runs.lock() {
            runs.remove(run_id);
        }
        if let Ok(mut runs) = self.paused_runs.lock() {
            runs.remove(run_id);
        }
    }

    pub(super) fn pause(&self, run_id: &str) {
        if let Ok(mut runs) = self.paused_runs.lock() {
            runs.insert(run_id.to_string());
        }
    }

    pub(super) fn resume(&self, run_id: &str) {
        if let Ok(mut runs) = self.paused_runs.lock() {
            runs.remove(run_id);
        }
    }

    pub(super) fn is_paused(&self, run_id: &str) -> bool {
        self.paused_runs
            .lock()
            .map(|runs| runs.contains(run_id))
            .unwrap_or(false)
    }

    pub(super) async fn wait_until_resumed(&self, run_id: &str) -> bool {
        while self.is_paused(run_id) && !self.is_cancelled(run_id) {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
        !self.is_cancelled(run_id)
    }

    pub(super) fn finish(&self, run_id: &str) {
        if let Ok(mut runs) = self.paused_runs.lock() {
            runs.remove(run_id);
        }
        if let Ok(mut runs) = self.cancelled_runs.lock() {
            runs.remove(run_id);
        }
    }
}

pub(super) async fn wait_for_crawl_cancellation(control: &CrawlControl, run_id: &str) {
    while !control.is_cancelled(run_id) {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
}
