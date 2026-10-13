use super::race_render;
use crate::commands::site_crawler::control::CrawlControl;
use crate::commands::site_crawler::fetch_types::{CrawlFetchFailure, FetchedResponse};
use std::time::Duration;

type Outcome = Result<FetchedResponse, CrawlFetchFailure>;

#[tokio::test]
async fn race_render_reports_timeout_and_marks_the_run() {
    let mut timed_out = false;
    let pending = std::future::pending::<Outcome>();
    let error = race_render(
        pending,
        &CrawlControl::new(),
        "run",
        Duration::from_millis(5),
        &mut timed_out,
    )
    .await
    .err()
    .unwrap();
    assert_eq!(error.kind, "timeout");
    assert_eq!(
        error.message,
        "Rendered page exceeded the remaining crawl time."
    );
    assert!(timed_out);
}

#[tokio::test]
async fn race_render_reports_cancellation_without_timeout() {
    let control = CrawlControl::new();
    control.cancelled_runs.lock().unwrap().insert("run".into());
    let mut timed_out = false;
    let error = race_render(
        std::future::pending::<Outcome>(),
        &control,
        "run",
        Duration::from_secs(30),
        &mut timed_out,
    )
    .await
    .err()
    .unwrap();
    assert_eq!(error.kind, "cancelled");
    assert_eq!(error.message, "Crawl was cancelled during page rendering.");
    assert!(!timed_out);
}
