use super::data::OffPage;
use super::offpage_tables::{bounded, citations, sources, value};
use super::strings::offpage::{self as o, ALL, LIMITATION_KEYS, STATUSES};
use super::tests::text_of;
use super::tests_offpage::{record, with_record};
use serde_json::{json, Value};

#[test]
fn offpage_bounds_rows_and_long_unicode_rtl_text_through_the_pdf_pipeline() {
    let mut data = record();
    let long_url = format!(
        "https://source.test/{}UNPRINTED_TAIL",
        "مرحبا😀".repeat(100)
    );
    data["sources"] = json!((0..15)
        .map(|_| json!({"url": long_url}))
        .collect::<Vec<_>>());
    data["co_citations"] = json!((0..8).map(|offset| json!({
        "url": long_url, "offset": offset, "excerpt": format!("مرحبا 你好 Zażółć {}UNPRINTED_TAIL", "ن".repeat(400))
    })).collect::<Vec<_>>());
    let view = OffPage::new(&data);
    let source_table = sources(&view);
    let citation_table = citations(&view);
    assert_eq!(source_table.rows.len(), 10);
    assert_eq!(citation_table.rows.len(), 5);
    assert_eq!(source_table.rows[0][0].text.chars().count(), 240);
    assert_eq!(citation_table.rows[0][2].text.chars().count(), 300);
    assert!(source_table.rows[0][0].text.ends_with('…'));
    let text = text_of(&with_record(data));
    for expected in [
        "Off-page analysis",
        "مرحبا",
        "你好",
        "Zażółć",
        "not zero backlinks",
    ] {
        assert!(text.contains(expected), "missing: {expected}");
    }
    assert!(!text.contains("UNPRINTED_TAIL"));
}

#[test]
fn offpage_missing_rows_and_fields_do_not_invent_numbers_or_citations() {
    let data = json!({});
    let view = OffPage::new(&data);
    assert!(sources(&view).rows.is_empty());
    assert!(citations(&view).rows.is_empty());
    assert_eq!(value(&data, "absent"), "n/a");
    assert_eq!(value(&json!({"value": null}), "value"), "n/a");
    assert_eq!(bounded("قصير", 240), "قصير");
    assert_eq!(bounded(&"😀".repeat(241), 240).chars().count(), 240);
}

#[test]
fn offpage_known_limitations_are_translated_and_unknown_codes_remain_literal() {
    let mut data = record();
    data["tbva"]["limitations"] =
        json!(["invalid-scale", "no-follow-links", "unknown-future-code"]);
    let text = text_of(&with_record(data));
    for expected in [
        "Invalid authority scale",
        "No follow links",
        "unknown-future-code",
    ] {
        assert!(text.contains(expected));
    }
    assert!(!text.contains("source-text-or-authority-missing"));
}

#[test]
fn every_offpage_label_exists_in_all_twelve_pdf_languages() {
    let mut keys: Vec<String> = ALL.iter().map(|key| (*key).to_owned()).collect();
    keys.extend(STATUSES.iter().map(|code| format!("{}.{code}", o::STATUS)));
    keys.extend(
        LIMITATION_KEYS
            .iter()
            .map(|code| format!("{}.{code}", o::LIMITATIONS)),
    );
    for language in [
        "en", "pl", "de", "es", "fr", "it", "pt", "ru", "ar", "ja", "ko", "zh",
    ] {
        let path = format!(
            "{}/../src/i18n/locales/{language}.json",
            env!("CARGO_MANIFEST_DIR")
        );
        let bundle: Value = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
        for key in &keys {
            let pointer = format!("/pdfReport/{}", key.replace('.', "/"));
            assert!(
                bundle
                    .pointer(&pointer)
                    .and_then(Value::as_str)
                    .is_some_and(|text| !text.is_empty()),
                "{language}: {key}"
            );
        }
    }
}

#[test]
fn offpage_uses_the_pdf_language_overlay_instead_of_english_labels() {
    let mut run = with_record(record());
    run["pdf_labels"]["crawl"]["offPage"] = json!({
        "title": "تحليل خارج الصفحة", "status": {"partial": "جزئي"},
        "limitations": {"source-text-or-authority-missing": "بيانات ناقصة"}
    });
    let text = text_of(&run);
    for expected in ["تحليل خارج الصفحة", "جزئي", "بيانات ناقصة"] {
        assert!(text.contains(expected), "missing: {expected}");
    }
    assert!(!text.contains("Off-page analysis"));
}
