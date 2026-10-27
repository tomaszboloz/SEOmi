use super::{
    models::{MAX_CAPTURE_CHUNKS, MAX_CAPTURE_CHUNK_BYTES},
    navigation::{is_allowed_navigation, parse_capture_chunk},
};
use url::Url;

#[test]
fn navigation_preserves_host_and_directory_boundaries() {
    for (target, subdomains, scope, expected) in [
        ("http://example.test/guide", false, None, true),
        ("https://docs.example.test/guide", true, None, true),
        ("https://docs.example.test/guide", false, None, false),
        ("https://evil-example.test/guide", true, None, false),
        ("https://example.test/anything", false, Some("  "), true),
        ("https://example.test/guide", false, Some("/guide/"), true),
        (
            "https://example.test/guide/chapter",
            false,
            Some("/guide/"),
            true,
        ),
        (
            "https://example.test/guidebook",
            false,
            Some("/guide/"),
            false,
        ),
        ("https://:password@example.test/guide", true, None, false),
        ("https://127.0.0.1/guide", true, None, false),
    ] {
        assert_eq!(
            is_allowed_navigation(
                &Url::parse(target).unwrap(),
                "EXAMPLE.TEST",
                subdomains,
                scope
            ),
            expected,
            "unexpected navigation decision for {target} with scope {scope:?}"
        );
    }
}

#[test]
fn chunk_parser_rejects_missing_and_malformed_transfer_metadata() {
    for path in [
        "",
        "4",
        "4/0",
        "bad/0/1",
        "4/bad/1",
        "4/0/bad",
        "4/0/0",
        "4/0/1/extra",
        "4/1/1",
        "4/0/1?other=payload",
        "4/0/1?data=",
    ] {
        let url = Url::parse(&format!("seomi-capture://nonce/{path}")).unwrap();
        assert!(
            parse_capture_chunk(&url, "nonce").is_none(),
            "accepted {path}"
        );
    }
    let too_many = Url::parse(&format!(
        "seomi-capture://nonce/4/0/{}?data=x",
        MAX_CAPTURE_CHUNKS + 1
    ))
    .unwrap();
    assert!(parse_capture_chunk(&too_many, "nonce").is_none());
}

#[test]
fn chunk_byte_and_count_limits_are_inclusive_and_decode_query_values() {
    let payload = "a".repeat(MAX_CAPTURE_CHUNK_BYTES);
    let valid = Url::parse(&format!(
        "seomi-capture://nonce/4/{}/{}?other=ignored&data={payload}",
        MAX_CAPTURE_CHUNKS - 1,
        MAX_CAPTURE_CHUNKS
    ))
    .unwrap();
    let chunk = parse_capture_chunk(&valid, "nonce").unwrap();
    assert_eq!(chunk.index, MAX_CAPTURE_CHUNKS - 1);
    assert_eq!(chunk.total, MAX_CAPTURE_CHUNKS);
    assert_eq!(chunk.data, payload);
    let oversized = Url::parse(&format!("{}a", valid.as_str())).unwrap();
    assert!(parse_capture_chunk(&oversized, "nonce").is_none());
    let encoded = Url::parse("seomi-capture://nonce/4/0/1?data=A%2BB%26C").unwrap();
    assert_eq!(
        parse_capture_chunk(&encoded, "nonce").unwrap().data,
        "A+B&C"
    );
}
