use super::labels::{enter, is_rtl, locale, t, tf};
use serde_json::json;

#[test]
fn locale_defaults_to_english_without_an_active_payload() {
    assert_eq!(locale(), "en");
    assert!(!is_rtl());
}

#[test]
fn locale_keeps_only_the_lowercase_primary_subtag() {
    for (code, expected) in [("PL", "pl"), ("pt-BR", "pt"), ("zh_Hans", "zh"), ("", "en")] {
        let _scope = enter(&json!({ "pdf_locale": code }));
        assert_eq!(locale(), expected, "locale code {code:?}");
    }
    assert_eq!(locale(), "en", "scope drop must reset the locale");
}

#[test]
fn rtl_is_detected_for_rtl_scripts_only() {
    for code in ["ar", "he-IL", "FA", "ur_PK"] {
        let _scope = enter(&json!({ "pdf_locale": code }));
        assert!(is_rtl(), "{code} is right to left");
    }
    for code in ["en", "pl", "de-AT"] {
        let _scope = enter(&json!({ "pdf_locale": code }));
        assert!(!is_rtl(), "{code} is left to right");
    }
}

#[test]
fn overlay_ignores_empty_text_and_tf_fills_placeholders() {
    let _scope = enter(&json!({
        "pdf_labels": { "x": { "k": "{{1}} before {{0}}", "empty": "" } }
    }));
    assert_eq!(t("x.k"), "{{1}} before {{0}}");
    assert_eq!(tf("x.k", &["a", "b"]), "b before a");
    assert_eq!(t("x.empty"), "x.empty");
}
