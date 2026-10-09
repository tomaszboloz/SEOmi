use super::charts::{audit_chart, crawl_chart, PdfChartBar};
use super::crawl_page_summary::append_page_summary;
use super::renderer::{chart_stream, pdf_bytes};
use super::text_utils::{ascii_pdf_text, pdf_literal, wrapped_lines};
use serde_json::json;

#[test]
fn chart_builders_cover_missing_values_and_http_boundaries() {
    assert!(crawl_chart(&json!({})).is_none());
    let fallback = crawl_chart(&json!({"result": {"pages": []}})).unwrap();
    assert_eq!(fallback.len(), 3);
    assert_eq!(fallback[0].label, "Pages crawled");
    assert_eq!(fallback[0].value, 0);
    assert_eq!(fallback[1].label, "HTTP 2xx");
    assert_eq!(fallback[2].label, "HTTP 4xx/5xx");
    assert!(crawl_chart(&json!({"result": {}})).is_none());

    let full = json!({"result": {"pages_crawled": 7, "critical_count": 2,
    "warning_count": 3, "health_score": 140, "pages": [
        {"http_status": 199}, {"http_status": 200}, {"http_status": 299},
        {"http_status": 300}, {"http_status": 400}, {"http_status": 503}, {}
    ]}});
    let bars = crawl_chart(&full).unwrap();
    assert_eq!(
        bars.iter().map(|bar| bar.value).collect::<Vec<_>>(),
        [100, 7, 2, 3, 2, 2]
    );
    assert!(audit_chart(&json!({})).is_none());
    let audit = audit_chart(&json!({"health_score": 140,
        "security_headers": {"score": 101}, "headings": {"h1_count": 2},
        "images": [{"src": "local.svg"}], "links": {"total_links": 4}}))
    .unwrap();
    assert_eq!(
        audit.iter().map(|bar| bar.value).collect::<Vec<_>>(),
        [100, 100, 2, 1, 4]
    );
}

#[test]
fn pdf_rendering_escapes_labels_and_keeps_bar_widths_in_bounds() {
    let stream = chart_stream(&[
        PdfChartBar {
            label: "A(B)\\C".into(),
            value: 20,
            scale: 10,
        },
        PdfChartBar {
            label: "zero".into(),
            value: 1,
            scale: 0,
        },
        PdfChartBar {
            label: "empty".into(),
            value: 0,
            scale: 1,
        },
    ]);
    assert!(stream.contains("(A\\(B\\)\\\\C: 20) Tj"));
    assert!(stream.contains("190 690 360 24 re f"));
    assert!(stream.contains("190 608 0 24 re f"));
    assert!(stream.contains("190 526 0 24 re f"));

    let bytes = pdf_bytes(vec![], None);
    let empty = String::from_utf8_lossy(&bytes);
    assert!(empty.starts_with("%PDF-1.4"));
    assert!(empty.contains("/Count 1"));
    assert!(!empty.contains("Crawl metrics - saved run"));

    let long = (0..49)
        .map(|index| format!("line-{index}"))
        .collect::<Vec<_>>();
    let bytes = pdf_bytes(
        long,
        Some(vec![PdfChartBar {
            label: "chart".into(),
            value: 1,
            scale: 1,
        }]),
    );
    let report = String::from_utf8_lossy(&bytes);
    assert!(report.contains("/Count 3"));
    assert!(report.ends_with("%%EOF\n"));
}

#[test]
fn text_helpers_preserve_pdf_escaping_and_page_summary_fallbacks() {
    assert_eq!(ascii_pdf_text("ąĆęŁńÓśŻź\\()é\t"), "acelnoszz\\()e?");
    assert_eq!(pdf_literal("A(B)\\C"), "A\\(B\\)\\\\C");
    assert_eq!(wrapped_lines("", 4), vec!["-"]);
    assert_eq!(wrapped_lines("aa bb", 3), vec!["aa", "bb"]);

    let mut lines = Vec::new();
    let read = |value: &serde_json::Value, key: &str| {
        value
            .get(key)
            .and_then(serde_json::Value::as_str)
            .unwrap_or("-")
            .to_owned()
    };
    let number = |value: &serde_json::Value, key: &str| {
        value
            .get(key)
            .and_then(serde_json::Value::as_i64)
            .map(|number| number.to_string())
            .unwrap_or_else(|| "-".into())
    };
    append_page_summary(
        &mut lines,
        &json!({"url": "https://local.test"}),
        &read,
        &number,
    );
    assert!(lines.iter().any(|line| line.contains("Issues: none")));
    assert!(lines
        .iter()
        .any(|line| line.contains("- | - | https://local.test")));

    lines.clear();
    append_page_summary(
        &mut lines,
        &json!({
            "url": "https://local.test/page",
            "title": "Local",
            "http_status": 200,
            "depth": 1,
            "response_time_ms": 12,
            "indexability_status": "indexable",
            "word_count": 50,
            "indexability_verdict": {"status": "eligible", "reasons": ["200", "canonical"]},
            "redirect_stop_reason": "redirect limit",
            "issues": [{"severity": "Warning", "message": "Missing alt"}]
        }),
        &read,
        &number,
    );
    assert!(lines
        .iter()
        .any(|line| line.contains("Indexability verdict: eligible (200, canonical)")));
    assert!(lines
        .iter()
        .any(|line| line.contains("Redirect stop reason: redirect limit")));
    assert!(lines
        .iter()
        .any(|line| line.contains("[Warning] Missing alt")));
}

#[test]
fn rejects_audit_pdf_without_final_url() {
    assert!(super::generate_audit_pdf(json!({})).is_err());
}
