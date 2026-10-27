use super::*;
use crate::commands::site_crawler::render_health::{
    remaining_run_time, MAX_CONSECUTIVE_RENDER_FAILURES,
};
use std::time::{Duration, Instant};

#[test]
fn renderer_is_switched_off_after_consecutive_failures_only() {
    let mut health = RenderHealth::default();
    for _ in 0..MAX_CONSECUTIVE_RENDER_FAILURES - 1 {
        health.record_fallback();
    }
    assert!(health.rendering_enabled());
    // A success in between resets the streak but keeps the total.
    health.record_success();
    health.record_fallback();
    assert!(health.rendering_enabled());
    assert_eq!(health.fallback_pages, MAX_CONSECUTIVE_RENDER_FAILURES);
    for _ in 0..MAX_CONSECUTIVE_RENDER_FAILURES - 1 {
        health.record_fallback();
    }
    assert!(!health.rendering_enabled());
}

#[test]
fn health_counts_rendered_and_fallback_pages_and_ignores_unrendered_responses() {
    let mut health = RenderHealth::default();
    let mut fallback = page_data(200, true, true);
    fallback.render_fallback = Some("capture timed out".into());
    health.observe(&fallback);
    health.observe(&fallback);
    assert_eq!((health.fallback_pages, health.consecutive_failures), (2, 2));

    // A download or an error page says nothing about the renderer.
    health.observe(&page_data(404, true, true));
    health.observe(&page_data(200, false, true));
    assert_eq!((health.fallback_pages, health.consecutive_failures), (2, 2));

    let mut rendered = page_data(200, true, true);
    rendered.rendered_diagnostics = Some((Vec::new(), Vec::new()));
    health.observe(&rendered);
    assert_eq!((health.fallback_pages, health.consecutive_failures), (2, 0));
}

#[test]
fn remaining_run_time_is_unbounded_without_a_budget_and_never_negative() {
    let started = Instant::now();
    assert!(remaining_run_time(started, None) > Duration::from_secs(3_600));
    let partial = remaining_run_time(started, Some(100));
    assert!(partial > Duration::from_secs(90));
    assert!(partial <= Duration::from_secs(100));
    std::thread::sleep(Duration::from_millis(5));
    assert_eq!(remaining_run_time(started, Some(0)), Duration::ZERO);
    let past = Instant::now() - Duration::from_secs(10);
    assert_eq!(remaining_run_time(past, Some(5)), Duration::ZERO);
}

#[test]
fn health_constants_and_mixed_observation_edges() {
    assert_eq!(
        crate::commands::site_crawler::render_health::MAX_RENDER_SESSIONS,
        6
    );
    assert_eq!(MAX_CONSECUTIVE_RENDER_FAILURES, 5);

    let mut health = RenderHealth::default();
    let unhandled = page_data(301, false, false);
    health.observe(&unhandled);
    assert_eq!((health.fallback_pages, health.consecutive_failures), (0, 0));

    let mut mixed = page_data(200, true, true);
    mixed.rendered_diagnostics = Some((Vec::new(), Vec::new()));
    mixed.render_fallback = Some("partial error".into());
    health.observe(&mixed);
    assert_eq!((health.fallback_pages, health.consecutive_failures), (1, 1));
}
