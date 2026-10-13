use super::super::page_fetch::fetch_page_step;
use super::page_fetch_fixture::{
    chunk, configure_session, empty_state, payload, rendered_server, session,
};
use super::*;
use crate::commands::rendered_crawler::CaptureEvent;
use std::time::{Duration, Instant};

#[tokio::test]
async fn rendered_fetch_restarts_the_crawl_delay_interval_after_navigation() {
    let server = rendered_server().await;
    let url = server.url("/rendered");
    let encoded = payload();
    let (app, mut session, _) = session(
        vec![CaptureEvent::PageReady(7), chunk(7, 0, 1, encoded)],
        false,
    );
    configure_session(&mut session, &url, &server.setup.base_host);
    let mut state = empty_state();
    state.rendered_sessions.push(session);
    let before = Instant::now();
    let (result, _) = fetch_page_step(
        &app.handle(),
        &CrawlControl::new(),
        &server.setup,
        &mut state,
        Some(Duration::from_millis(1)),
        &url,
    )
    .await;
    assert!(result.is_ok());
    assert!(state.last_page_request_at.unwrap() >= before);
}

#[tokio::test]
async fn cancellation_during_the_crawl_delay_pause_aborts_before_any_request() {
    let (app, _session, _) = session(Vec::new(), true);
    let mut state = empty_state();
    state.last_page_request_at = Some(Instant::now());
    let setup = super::page_fetch_fixture::rendered_setup();
    let control = CrawlControl::new();
    control
        .cancelled_runs
        .lock()
        .unwrap()
        .insert(setup.run_id.clone());
    let (result, duration) = fetch_page_step(
        &app.handle(),
        &control,
        &setup,
        &mut state,
        Some(Duration::from_secs(30)),
        "https://example.test/page",
    )
    .await;
    let failure = result.err().expect("cancelled pause must fail the fetch");
    assert_eq!(failure.kind, "cancelled");
    assert_eq!(
        failure.message,
        "Crawl was cancelled during crawl-delay pause."
    );
    assert_eq!(duration, 0);
}
