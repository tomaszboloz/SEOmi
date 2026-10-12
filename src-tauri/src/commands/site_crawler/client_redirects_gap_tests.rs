use super::*;

#[test]
fn amp_target_aligns_with_the_final_source_url() {
    let statuses = HashMap::from([("https://e.com/amp".to_string(), 200u16)]);
    let canonicals = HashMap::from([(
        "https://e.com/amp".to_string(),
        Some("https://e.com/final".to_string()),
    )]);
    let (status, alignment) = verify_amp_target(
        "https://e.com/start",
        "https://e.com/final",
        "https://e.com/amp",
        &statuses,
        &canonicals,
    );
    assert_eq!(status, Some(200));
    assert_eq!(alignment.as_deref(), Some("canonical-to-source"));
}

#[test]
fn client_redirect_rejects_negative_and_non_finite_delays() {
    let base = url::Url::parse("https://e.com/").unwrap();
    for declaration in ["-1; url=/x", "inf; url=/x", "NaN; url=/x"] {
        let redirect = parse_client_redirect("meta", declaration, &base);
        assert_eq!(redirect.delay_seconds, None, "{declaration}");
    }
    let ok = parse_client_redirect("meta", "2; url=/x", &base);
    assert_eq!(ok.delay_seconds, Some(2.0));
}
