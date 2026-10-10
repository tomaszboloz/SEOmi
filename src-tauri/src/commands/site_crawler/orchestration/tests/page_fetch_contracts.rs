use super::super::page_fetch::fetch_page_step;
use super::page_fetch_fixture::{
    chunk, configure_session, empty_state, payload, rendered_server, rendered_setup, session,
};
use super::*;
use crate::commands::{rendered_crawler::CaptureEvent, site_crawler::fetch_types::FetchedPageBody};
use std::time::{Duration, Instant};

#[tokio::test]
async fn browser_rendered_capture_success_maps_snapshot_to_fetched_response() {
    let server = rendered_server().await;
    let url = server.url("/rendered");
    let encoded = payload();
    let split = encoded.len() / 2;
    let (app, session, _) = session(
        vec![
            CaptureEvent::PageReady(7),
            chunk(7, 0, 2, &encoded[..split]),
            chunk(7, 1, 2, &encoded[split..]),
        ],
        false,
    );
    let mut session = session;
    configure_session(&mut session, &url, &server.setup.base_host);
    let mut state = empty_state();
    state.rendered_sessions.push(session);
    let (result, _) = fetch_page_step(
        &app.handle(),
        &CrawlControl::new(),
        &server.setup,
        &mut state,
        None,
        &url,
    )
    .await;
    let fetched = match result {
        Ok(fetched) => fetched,
        Err(failure) => panic!("rendered capture unexpectedly failed: {}", failure.message),
    };
    assert!(fetched.request_duration_ms.is_some());
    match fetched.response {
        FetchedPageBody::Prefetched(data) => {
            assert_eq!(data.status, 200);
            assert_eq!(data.http_response_url.as_deref(), Some(url.as_str()));
            assert_eq!(data.body, b"<main>ok</main>");
            assert!(data.rendered_diagnostics.is_some());
            assert_eq!(data.browser_navigation_time_ms, Some(12));
        }
        _ => panic!("hybrid response must retain its rendered snapshot"),
    }
}

#[tokio::test]
async fn browser_rendered_capture_failure_falls_back_to_http_body() {
    let server = rendered_server().await;
    let url = server.url("/rendered");
    let (app, session, _) = session(
        vec![CaptureEvent::PageReady(3), CaptureEvent::TransferFailed(3)],
        false,
    );
    let mut session = session;
    configure_session(&mut session, &url, &server.setup.base_host);
    let mut state = empty_state();
    state.rendered_sessions.push(session);
    let (result, _) = fetch_page_step(
        &app.handle(),
        &CrawlControl::new(),
        &server.setup,
        &mut state,
        None,
        &url,
    )
    .await;
    let fetched = match result {
        Ok(fetched) => fetched,
        Err(failure) => panic!("HTTP fallback unexpectedly failed: {}", failure.message),
    };
    assert!(fetched.request_duration_ms.is_some());
    match fetched.response {
        FetchedPageBody::Prefetched(data) => {
            assert_eq!(data.status, 200);
            assert_eq!(data.body, b"<html><main>http</main></html>");
            assert_eq!(
                data.render_fallback.as_deref(),
                Some("Renderer capture transfer failed after bounded retries.")
            );
            assert!(data.rendered_diagnostics.is_none());
        }
        _ => panic!("failed rendering must fall back to the HTTP body"),
    }
}

#[tokio::test]
async fn browser_rendered_capture_honors_cancellation() {
    let (app, session, _sender) = session(Vec::new(), true);
    let mut state = empty_state();
    state.rendered_sessions.push(session);
    let setup = rendered_setup();
    let control = CrawlControl::new();
    control
        .cancelled_runs
        .lock()
        .unwrap()
        .insert(setup.run_id.clone());
    let (result, _) = fetch_page_step(
        &app.handle(),
        &control,
        &setup,
        &mut state,
        None,
        "https://example.test/rendered",
    )
    .await;
    match result {
        Err(failure) => assert_eq!(failure.kind, "cancelled"),
        Ok(_) => panic!("cancelled capture unexpectedly succeeded"),
    }
}

#[tokio::test]
async fn browser_rendered_capture_marks_expired_budget_as_timeout() {
    let (app, session, _sender) = session(Vec::new(), true);
    let mut state = empty_state();
    state.rendered_sessions.push(session);
    let mut setup = rendered_setup();
    setup.max_run_seconds = Some(1);
    setup.start_time = Instant::now() - Duration::from_secs(2);
    let (result, _) = fetch_page_step(
        &app.handle(),
        &CrawlControl::new(),
        &setup,
        &mut state,
        None,
        "https://example.test/rendered",
    )
    .await;
    let failure = match result {
        Err(failure) => failure,
        Ok(_) => panic!("expired capture unexpectedly succeeded"),
    };
    assert_eq!(failure.kind, "timeout");
    assert!(state.timed_out);
    assert_eq!(state.rendered_sessions.len(), 1);
    assert!(state.rendered_sessions[0].initial_load_pending);
}
