use tauri::{AppHandle, Emitter, Runtime};

use super::super::control::CrawlProgress;
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

pub(super) fn emit_crawl_progress<R: Runtime>(
    app: &AppHandle<R>,
    setup: &CrawlSetup,
    state: &CrawlLoopState<R>,
    current_url: &str,
) {
    let elapsed_seconds = setup.start_time.elapsed().as_secs_f64();
    let pages_per_second = if elapsed_seconds > 0.0 {
        state.pages.len() as f64 / elapsed_seconds
    } else {
        0.0
    };
    let _ = app.emit(
        "crawl-progress",
        CrawlProgress {
            run_id: setup.run_id.clone(),
            current_url: Some(current_url.to_owned()),
            discovered: state.visited.len(),
            completed: state.pages.len(),
            queued: state.queue.len() + state.prefetched_order.len(),
            cancelled: false,
            paused: false,
            elapsed_ms: setup.start_time.elapsed().as_millis() as u64,
            pages_per_second,
        },
    );
}
