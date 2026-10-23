use super::*;
use reqwest::header::{HeaderValue, SERVER};

fn secs(value: u64) -> Option<Duration> {
    Some(Duration::from_secs(value))
}

#[test]
fn doubles_on_throttling_and_caps() {
    let mut backoff = AdaptiveBackoff::default();
    assert_eq!(backoff.effective_delay(None), None);
    backoff.observe(429, &HeaderMap::new());
    assert_eq!(backoff.effective_delay(None), secs(1));
    backoff.observe(503, &HeaderMap::new());
    assert_eq!(backoff.effective_delay(secs(2)), secs(4));
    for _ in 0..10 {
        backoff.observe(429, &HeaderMap::new());
    }
    assert_eq!(backoff.effective_delay(None), secs(60));
}

#[test]
fn decays_on_healthy_responses_down_to_zero() {
    let mut backoff = AdaptiveBackoff::default();
    backoff.observe(429, &HeaderMap::new());
    backoff.observe(429, &HeaderMap::new());
    backoff.observe(200, &HeaderMap::new());
    assert_eq!(backoff.effective_delay(None), secs(1));
    for _ in 0..3 {
        backoff.observe(200, &HeaderMap::new());
    }
    assert_eq!(backoff.effective_delay(secs(3)), secs(3));
}

#[test]
fn reports_the_blocking_vendor_for_a_waf_403() {
    let mut backoff = AdaptiveBackoff::default();
    let mut headers = HeaderMap::new();
    headers.insert(SERVER, HeaderValue::from_static("AkamaiGHost"));
    assert_eq!(backoff.observe(403, &headers), Some("Akamai"));
    assert_eq!(backoff.effective_delay(None), secs(1));
    assert_eq!(backoff.observe(404, &HeaderMap::new()), None);
    backoff.observe(429, &HeaderMap::new());
}
