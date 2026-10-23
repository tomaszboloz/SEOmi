use super::*;
use reqwest::header::{HeaderName, HeaderValue};

fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
    pairs
        .iter()
        .map(|(name, value)| {
            (
                HeaderName::from_bytes(name.as_bytes()).unwrap(),
                HeaderValue::from_str(value).unwrap(),
            )
        })
        .collect()
}

#[test]
fn names_each_known_vendor_on_blocking_statuses() {
    let cases = [
        (&[("cf-mitigated", "challenge")][..], "Cloudflare"),
        (
            &[("cf-ray", "1"), ("server", "cloudflare")][..],
            "Cloudflare",
        ),
        (&[("x-sucuri-id", "1")][..], "Sucuri"),
        (&[("x-datadome", "protected")][..], "DataDome"),
        (&[("server", "DataDome")][..], "DataDome"),
        (&[("x-amzn-waf-action", "block")][..], "AWS WAF"),
        (&[("x-iinfo", "1")][..], "Imperva"),
        (&[("server", "AkamaiGHost")][..], "Akamai"),
    ];
    for (pairs, vendor) in cases {
        assert_eq!(detect_waf_block(403, &headers(pairs)), Some(vendor));
    }
}

#[test]
fn ignores_successful_and_unmarked_responses() {
    let cloudflare = headers(&[("cf-ray", "1"), ("server", "cloudflare")]);
    assert_eq!(detect_waf_block(200, &cloudflare), None);
    assert_eq!(detect_waf_block(404, &cloudflare), None);
    assert_eq!(detect_waf_block(429, &HeaderMap::new()), None);
    assert_eq!(detect_waf_block(503, &headers(&[("cf-ray", "1")])), None);
}
