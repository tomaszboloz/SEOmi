use super::super::page_fetch::fetch_page_step;
use super::page_fetch_fixture::{chunk, empty_state, payload, rendered_setup, session};
use super::*;
use crate::commands::{rendered_crawler::CaptureEvent, site_crawler::fetch_types::FetchedPageBody};
use std::time::{Duration, Instant};

#[tokio::test]
async fn browser_rendered_capture_success_maps_snapshot_to_fetched_response() {
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
    let mut state = empty_state();
    state.rendered_session = Some(session);
    let (result, _) = fetch_page_step(
        &app.handle(),
        &CrawlControl::new(),
        &rendered_setup(),
        &mut state,
        None,
        "https://example.test/rendered",
    )
    .await;
    let fetched = match result {
        Ok(fetched) => fetched,
        Err(failure) => panic!("rendered capture unexpectedly failed: {}", failure.message),
    };
    match fetched.response {
        FetchedPageBody::Rendered(snapshot) => {
            assert_eq!(snapshot.final_url, "https://example.test/rendered");
            assert_eq!(snapshot.http_status, Some(200));
            assert_eq!(snapshot.html, "<main>ok</main>");
        }
        _ => panic!("browser-rendered response must retain its snapshot"),
    }
}

#[tokio::test]
async fn browser_rendered_capture_failure_is_reported_and_init_errors_are_retained() {
    let (app, session, _) = session(
        vec![CaptureEvent::PageReady(3), CaptureEvent::TransferFailed(3)],
        false,
    );
    let mut state = empty_state();
    state.rendered_session = Some(session);
    let (result, _) = fetch_page_step(
        &app.handle(),
        &CrawlControl::new(),
        &rendered_setup(),
        &mut state,
        None,
        "https://example.test/rendered",
    )
    .await;
    let failure = match result {
        Err(failure) => failure,
        Ok(_) => panic!("renderer failure unexpectedly succeeded"),
    };
    assert_eq!(failure.kind, "browser_render");
    assert!(failure.message.contains("bounded retries"));
    state.rendered_session = None;
    state.rendered_init_error = Some("renderer unavailable".into());
    let (result, _) = fetch_page_step(
        &app.handle(),
        &CrawlControl::new(),
        &rendered_setup(),
        &mut state,
        None,
        "https://example.test/rendered",
    )
    .await;
    match result {
        Err(failure) => assert_eq!(failure.message, "renderer unavailable"),
        Ok(_) => panic!("retained renderer error unexpectedly succeeded"),
    }
}

#[tokio::test]
async fn browser_rendered_capture_honors_cancellation() {
    let (app, session, _sender) = session(Vec::new(), true);
    let mut state = empty_state();
    state.rendered_session = Some(session);
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
    state.rendered_session = Some(session);
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
}
