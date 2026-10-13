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
