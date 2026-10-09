use super::super::{
    control::{wait_for_crawl_cancellation, CrawlControl},
    svg_dimensions::{parse_dimension_token, svg_intrinsic_dimensions},
};
use std::sync::Arc;
use std::time::Duration;

#[tokio::test]
async fn cancellation_wait_and_finish_clear_run_state() {
    let control = Arc::new(CrawlControl::new());
    control.pause("run");
    control.cancelled_runs.lock().unwrap().insert("run".into());
    assert!(!control.wait_until_resumed("run").await);
    control.finish("run");
    assert!(!control.is_cancelled("run"));
    assert!(!control.is_paused("run"));

    let waiter = control.clone();
    let task = tokio::spawn(async move {
        wait_for_crawl_cancellation(&waiter, "later").await;
    });
    tokio::time::sleep(Duration::from_millis(10)).await;
    control
        .cancelled_runs
        .lock()
        .unwrap()
        .insert("later".into());
    task.await.unwrap();
}

#[test]
fn poisoned_mutex_defaults_safely_across_control_methods() {
    let control = CrawlControl::new();
    let _ = std::panic::catch_unwind(|| {
        let _guard = control.cancelled_runs.lock().unwrap();
        panic!("poison cancelled_runs");
    });
    let _ = std::panic::catch_unwind(|| {
        let _guard = control.paused_runs.lock().unwrap();
        panic!("poison paused_runs");
    });
    assert!(control.is_cancelled("any-run"));
    assert!(!control.is_paused("any-run"));
    control.start("any-run");
    control.pause("any-run");
    control.resume("any-run");
    control.finish("any-run");
}

#[test]
fn svg_dimensions_accept_bounded_tokens_and_viewbox_fallback() {
    assert_eq!(parse_dimension_token(" 12.9px "), Some(12));
    assert_eq!(parse_dimension_token("0"), None);
    assert_eq!(parse_dimension_token("-4"), None);
    assert_eq!(parse_dimension_token("not-a-number"), None);
    assert_eq!(
        svg_intrinsic_dimensions(br#"<svg width="80px" height="40"></svg>"#),
        Some((80, 40))
    );
    assert_eq!(
        svg_intrinsic_dimensions(br#"<svg viewBox="0,0,120,60"></svg>"#),
        Some((120, 60))
    );
    assert_eq!(
        svg_intrinsic_dimensions(br#"<svg viewBox="0 0 20"></svg>"#),
        None
    );
    assert_eq!(
        svg_intrinsic_dimensions(br#"<svg viewBox="0 0 -1 40"></svg>"#),
        None
    );
    assert!(svg_intrinsic_dimensions(&[0xff, 0xfe]).is_none());
}
