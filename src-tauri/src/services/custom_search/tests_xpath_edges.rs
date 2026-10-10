use super::models::{XPathPredicate, XPathTerminal, XPathTextMatch};
use super::tests_common::query;
use super::xpath::xpath_to_css;
use super::xpath_predicate_helpers::*;
use super::xpath_predicates::xpath_predicate_to_css;
use super::xpath_text_predicates::parse_text_predicate;
use super::{extract_custom_search_results, validate_custom_searches};
use scraper::Html;

#[test]
fn quoted_brackets_are_literal_characters_not_predicate_boundaries() {
    let document =
        Html::parse_document("<a data-key='a]b[c'>Exact</a><a data-key='other'>Other</a>");
    for expression in [
        "//a[@data-key='a]b[c']/text()",
        "//a[contains(@data-key, ']b[')]/text()",
        "//a[starts-with(@data-key, 'a]')]/text()",
    ] {
        let search = query("xpath", expression, "text");
        assert_eq!(
            validate_custom_searches(std::slice::from_ref(&search)),
            Ok(())
        );
        let results = extract_custom_search_results(&document, &[search]);
        assert_eq!(results[0].values, ["Exact"]);
        assert_eq!(results[0].error, None);
    }
}

#[test]
fn xpath_helpers_preserve_quotes_nesting_and_unicode() {
    assert_eq!(xpath_predicate_end("@x='ż]ółć']suffix"), Some(14));
    assert_eq!(xpath_predicate_end("@x=\"a]b\"]"), Some(8));
    assert_eq!(xpath_predicate_end("@x='unclosed]"), None);
    assert_eq!(xpath_predicate_end("@x='complete'"), None);
    assert_eq!(
        split_xpath_and("@a='x and y' and contains(@b, 'z')"),
        Some(vec!["@a='x and y'", "contains(@b, 'z')"])
    );
    assert_eq!(split_xpath_and("contains(@a, \"and\")"), None);
    assert_eq!(split_xpath_and("@candy"), None);
    assert_eq!(split_xpath_and("@a andrew"), None);
    assert_eq!(split_xpath_and("and @a and"), Some(vec!["", "@a", ""]));
    assert_eq!(xpath_literal(" 'żółć' "), Ok("żółć".into()));
    assert_eq!(xpath_literal("\"\""), Ok(String::new()));
    for invalid in ["", "x", "abc", "'open\"", "'a'b'"] {
        assert!(xpath_literal(invalid).is_err(), "{invalid}");
    }
    assert_eq!(escape_css_string("a\\b\"c"), "a\\\\b\\\"c");
    assert_eq!(
        normalize_xpath_space(" \tżółć\n  中文 \u{a0} test "),
        "żółć 中文 test"
    );
    assert!(is_xpath_name_char(':'));
    assert!(!is_xpath_name_char('ż'));
}

#[test]
fn predicates_have_direct_success_and_error_assertions() {
    for (expression, expected) in [
        ("@a", "[a]"),
        ("@a='b'", "[a=\"b\"]"),
        ("@a!='b'", "[a]:not([a=\"b\"])"),
        ("not(@a)", ":not([a])"),
        ("position() = 2", ":nth-of-type(2)"),
        ("last()", ":last-of-type"),
        ("position()=last()", ":last-of-type"),
        ("3", ":nth-of-type(3)"),
    ] {
        match xpath_predicate_to_css(expression).unwrap() {
            XPathPredicate::Css(css) => assert_eq!(css, expected),
            _ => panic!("expected CSS for {expression}"),
        }
    }
    for expression in [
        "0",
        "position()=0",
        "position()=abc",
        "@bad name",
        "@bad name='x'",
        "@bad name!='x'",
        "starts-with(@a)",
        "starts-with(text(),'x')",
        "starts-with(@bad name,'x')",
        "not(text())",
        "not(@bad name)",
        "contains(@a)",
        "contains(@bad name,'x')",
        "contains(foo(),'x')",
        "@a and",
        "text()='x' and @a",
        "unknown()",
    ] {
        assert!(xpath_predicate_to_css(expression).is_err(), "{expression}");
    }
    match parse_text_predicate("normalize-space(text())='x'")
        .unwrap()
        .unwrap()
    {
        XPathPredicate::TextMatch(value) => {
            assert_eq!(value, XPathTextMatch::EqualsNormalized("x".into()))
        }
        _ => panic!("expected text match"),
    }
    assert!(parse_text_predicate("text()=invalid").unwrap().is_err());
    assert!(parse_text_predicate("unsupported()").is_none());
}

#[test]
fn paths_reject_unsupported_steps_and_multiple_text_filters() {
    let selector = xpath_to_css(".//main/a/@href").unwrap();
    assert_eq!(selector.css, "main > a");
    assert_eq!(selector.terminal, XPathTerminal::Attribute("href".into()));
    for expression in [
        "",
        "div",
        "/",
        ".",
        "//a/@bad name",
        "//a/@",
        "//a/text()/b",
        "//a/@id/b",
        "//a()",
        "//[1]",
        "//a[1]suffix",
        "//a[1",
        "//a[text()='x'][text()='y']",
        "//a[text()='x']/b[text()='y']",
        "//a:b",
        "//a]",
        "//a[[1]]",
        "// ",
        ".@id",
    ] {
        assert!(xpath_to_css(expression).is_err(), "{expression}");
    }
}

#[test]
fn paths_cover_quoted_slashes_relative_dots_and_invalid_tag_names() {
    assert_eq!(
        xpath_to_css("//a[@href='x/y'][@title='a\"b']").unwrap().css,
        "a[href=\"x/y\"][title=\"a\\\"b\"]"
    );
    for expression in [".//a/./b", "//a/ @href", "//a()[1]"] {
        assert!(xpath_to_css(expression).is_err(), "{expression}");
    }
}
