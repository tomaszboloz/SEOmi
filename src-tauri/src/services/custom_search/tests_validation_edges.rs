use super::tests_common::query;
use super::validation::{is_valid_attribute_name, validate_custom_searches};

#[test]
fn validation_accepts_limits_and_normalized_modes_without_mutating_input() {
    let searches = (0..10)
        .map(|index| {
            let mut search = query(" CSS ", "a", " TEXT ");
            search.id = index.to_string();
            search.name = "ż".repeat(80);
            search.query = format!("a{}", " ".repeat(511));
            search
        })
        .collect::<Vec<_>>();
    assert_eq!(validate_custom_searches(&searches), Ok(()));
    let mut excessive = searches.clone();
    excessive.push(query("css", "a", "text"));
    assert!(validate_custom_searches(&excessive)
        .unwrap_err()
        .contains("10"));
    assert_eq!(searches[0].selector_type, " CSS ");
}

#[test]
fn validation_rejects_each_invalid_field_and_trimmed_duplicate_ids() {
    let base = query("css", "a", "text");
    let mut duplicate = base.clone();
    duplicate.id = format!(" {} ", base.id);
    assert!(validate_custom_searches(&[base.clone(), duplicate]).is_err());
    for (field, value) in [
        ("id", " ".into()),
        ("name", " ".into()),
        ("name", "ż".repeat(81)),
        ("query", " ".into()),
        ("query", "a".repeat(513)),
        ("mode", "unknown".into()),
        ("output", "unknown".into()),
        ("query", "[".into()),
    ] {
        let mut invalid = base.clone();
        match field {
            "id" => invalid.id = value,
            "name" => invalid.name = value,
            "query" => invalid.query = value,
            "mode" => invalid.selector_type = value,
            _ => invalid.result_type = value,
        }
        assert!(validate_custom_searches(&[invalid]).is_err(), "{field}");
    }
}

#[test]
fn attributes_and_xpath_terminal_outputs_are_explicit_contracts() {
    for search in [
        query("regex", "ż+", "text"),
        query("css", "a", "attribute"),
        query("xpath", "//a/@href", "attribute"),
    ] {
        assert_eq!(validate_custom_searches(&[search]), Ok(()));
    }
    for attribute in [None, Some(""), Some("bad name"), Some("a\"b")] {
        let mut search = query("css", "a", "attribute");
        search.attribute = attribute.map(str::to_owned);
        assert!(validate_custom_searches(&[search]).is_err());
    }
    for (expression, output) in [("//a/text()", "html"), ("//a/@href", "text")] {
        assert!(validate_custom_searches(&[query("xpath", expression, output)]).is_err());
    }
    for attribute in ["data-kind", "xml:lang", "a_b"] {
        assert!(is_valid_attribute_name(attribute));
    }
    for attribute in ["", "a b", "ż", "/x"] {
        assert!(!is_valid_attribute_name(attribute));
    }
    assert_eq!(
        validate_custom_searches(&[query("xpath", "//a", "html")]),
        Ok(())
    );
}
