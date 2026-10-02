use super::*;

#[test]
fn query_parameter_names_are_trimmed_lowercased_and_deduplicated() {
    let names = normalized_query_parameter_names(&[
        " Session ".into(),
        "session".into(),
        "".into(),
        "   ".into(),
        "REF".into(),
    ]);
    assert_eq!(
        names,
        HashSet::from(["session".to_string(), "ref".to_string()])
    );
}

#[test]
fn tracking_parameters_cover_click_ids_and_utm_prefix_only() {
    for name in [
        "gclid",
        "dclid",
        "fbclid",
        "msclkid",
        "mc_cid",
        "mc_eid",
        "_ga",
        "_gl",
        "utm_source",
        "utm_",
    ] {
        assert!(is_tracking_parameter(name), "{name}");
    }
    for name in ["utm", "gclid2", "page", "ga", "x_utm_source", ""] {
        assert!(!is_tracking_parameter(name), "{name}");
    }
}

#[test]
fn only_unreserved_escapes_are_decoded_and_others_are_uppercased() {
    assert_eq!(
        canonicalize_unreserved_percent_encoding("%7e%41%2d%5F%2E"),
        "~A-_."
    );
    assert_eq!(
        canonicalize_unreserved_percent_encoding("a%2fb%3fc"),
        "a%2Fb%3Fc"
    );
    assert_eq!(
        canonicalize_unreserved_percent_encoding("caf%c3%a9"),
        "caf%C3%A9"
    );
}

#[test]
fn malformed_escapes_are_preserved_verbatim() {
    for value in ["%", "100%", "%G1", "%1", "%1G", "a%%41"] {
        // An invalid escape consumes its next character, so "%%41" stays as written.
        assert_eq!(
            canonicalize_unreserved_percent_encoding(value),
            value,
            "{value}"
        );
    }
}
