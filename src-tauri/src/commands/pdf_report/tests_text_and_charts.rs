use super::charts::{audit_chart, crawl_chart, PdfChartBar};
use super::renderer::pdf_bytes;
use super::text_utils::{ascii_pdf_text, pdf_literal, wrapped_lines};
use serde_json::json;

#[test]
fn text_utils_exhaustive_diacritics_and_specials() {
    let polish_chars = "zażółć gęślą jaźń ZAŻÓŁĆ GĘŚLĄ JAŹŃ";
    let ascii = ascii_pdf_text(polish_chars);
    assert_eq!(ascii, "zazolc gesla jazn ZAzolc GesLa JAzn");
    assert_eq!(
        ascii_pdf_text("Äpfel Straße déjà vu, français, příliš žluťoučký, niño"),
        "Apfel Strasse deja vu, francais, prilis zlutoucky, nino"
    );
    assert_eq!(ascii_pdf_text("e\u{301} a\u{308}"), "e a");
    assert_eq!(ascii_pdf_text("a\u{483}"), "a");
    assert_eq!(ascii_pdf_text("ßœ ÆÞ ØĐ"), "ssoe AETH OD");

    // Parentheses and backslashes are escaped for PDF literal string
    let raw = r"func(arg1, \path)";
    let literal = pdf_literal(raw);
    assert_eq!(literal, r"func\(arg1, \\path\)");

    // Unsupported scripts and symbols remain explicit placeholders.
    assert_eq!(
        ascii_pdf_text("Emoji: 🚀, Symbol: ©"),
        "Emoji: ?, Symbol: ?"
    );

    // Wrapped lines handles single words and multiple words
    assert_eq!(wrapped_lines("   ", 10), vec!["-"]);
    assert_eq!(
        wrapped_lines("one two three four", 10),
        vec!["one two", "three four"]
    );
    assert_eq!(
        wrapped_lines("verylongwordthatcantfit", 5),
        vec!["veryl", "ongwo", "rdtha", "tcant", "fit"]
    );
    assert_eq!(wrapped_lines("ßœ", 3), vec!["sso", "e"]);
    assert_eq!(wrapped_lines("abc", 0), vec!["a", "b", "c"]);
}

#[test]
fn charts_cover_partial_metrics_and_error_distributions() {
    // Audit chart with only partial fields
    let audit_h1_only = audit_chart(&json!({"headings": {"h1_count": 3}})).unwrap();
    assert_eq!(audit_h1_only.len(), 1);
    assert_eq!(audit_h1_only[0].label, "H1 count");
    assert_eq!(audit_h1_only[0].value, 3);

    let audit_links_only = audit_chart(&json!({"links": {"total_links": 15}})).unwrap();
    assert_eq!(audit_links_only.len(), 1);
    assert_eq!(audit_links_only[0].label, "Links");
    assert_eq!(audit_links_only[0].value, 15);

    // Crawl chart with only 2xx pages
    let crawl_2xx = crawl_chart(&json!({
        "result": {
            "pages": [{"http_status": 200}, {"http_status": 204}]
        }
    }))
    .unwrap();
    let status_2xx_bar = crawl_2xx.iter().find(|b| b.label == "HTTP 2xx").unwrap();
    assert_eq!(status_2xx_bar.value, 2);

    // Crawl chart with only 5xx pages
    let crawl_5xx = crawl_chart(&json!({
        "result": {
            "pages": [{"http_status": 500}, {"http_status": 502}]
        }
    }))
    .unwrap();
    let status_err_bar = crawl_5xx
        .iter()
        .find(|b| b.label == "HTTP 4xx/5xx")
        .unwrap();
    assert_eq!(status_err_bar.value, 2);
}

#[test]
fn renderer_produces_consistent_multipage_pdf_structures() {
    // Generate 100 lines of text (fits onto at least 3 pages)
    let lines = (1..=100)
        .map(|index| format!("Report data row number {index}: https://example.test/item/{index}"))
        .collect::<Vec<_>>();

    let chart = vec![PdfChartBar {
        label: "Sample Metric".into(),
        value: 50,
        scale: 100,
    }];

    let bytes = pdf_bytes(lines, Some(chart));
    let pdf_str = String::from_utf8_lossy(&bytes);

    assert!(bytes.starts_with(b"%PDF-1.4"));
    assert!(pdf_str.contains("/Count 4")); // 3 text pages + 1 chart page
    assert!(pdf_str.contains("Sample Metric: 50"));
    assert!(pdf_str.contains("startxref\n"));
    assert!(pdf_str.ends_with("%%EOF\n"));
}

#[test]
fn renderer_wraps_long_urls_after_pdf_transliteration() {
    let long_url = format!("Straße https://example.test/{}", "x".repeat(180));
    let wrapped = wrapped_lines(&long_url, 96);
    assert!(wrapped.len() > 2);
    assert!(wrapped.iter().all(|line| line.len() <= 96));

    let bytes = pdf_bytes(vec![long_url], None);
    let report = String::from_utf8_lossy(&bytes);
    assert!(report.matches("Tj").count() > 2);
    assert!(report.ends_with("%%EOF\n"));
}
