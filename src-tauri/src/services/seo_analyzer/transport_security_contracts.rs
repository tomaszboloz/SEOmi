use super::transport_security::{enrich_header_technologies, parse_header_technology};
use std::collections::HashMap;

#[test]
fn parses_header_versions_with_safe_punctuation_and_bounds() {
    assert_eq!(
        parse_header_technology("nginx/1.2.3;", &["nginx"]),
        (Some("nginx".into()), Some("1.2.3".into()))
    );
    assert_eq!(
        parse_header_technology("nginx/1.2.3.", &["nginx"]),
        (Some("nginx".into()), None)
    );
    assert_eq!(
        parse_header_technology("nginx/1.2x.3", &["nginx"]),
        (Some("nginx".into()), None)
    );
    let oversized = format!("nginx/{}", "1".repeat(33));
    assert_eq!(
        parse_header_technology(&oversized, &["nginx"]),
        (Some("nginx".into()), None)
    );
}

#[test]
fn normal_server_without_cf_ray_does_not_claim_cloudflare() {
    let mut signals = Vec::new();
    enrich_header_technologies(
        &mut signals,
        &HashMap::from([(String::from("server"), String::from("nginx/1.2.3"))]),
    );
    assert_eq!(signals.len(), 1);
    assert_eq!(signals[0].name, "nginx");
    assert!(!signals.iter().any(|signal| signal.name == "Cloudflare"));
}
