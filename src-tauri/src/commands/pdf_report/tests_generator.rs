use super::tests::pdf_has_text;
use super::{generate_audit_pdf, generate_crawl_pdf};
use base64::Engine;
use serde_json::json;

fn decode_pdf(encoded: String) -> Vec<u8> {
    base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .unwrap()
}

#[test]
fn generate_audit_pdf_error_paths_and_fallbacks() {
    assert_eq!(
        generate_audit_pdf(json!({})).unwrap_err(),
        "The audit has no final URL to report."
    );
    assert_eq!(
        generate_audit_pdf(json!({"final_url": ""})).unwrap_err(),
        "The audit has no final URL to report."
    );

    let bytes =
        decode_pdf(generate_audit_pdf(json!({"final_url": "https://example.test"})).unwrap());
    assert!(bytes.starts_with(b"%PDF-1.4"));
    assert!(pdf_has_text(&bytes, "https://example.test"));
    assert!(pdf_has_text(&bytes, "AUDITED AT"));
    assert!(pdf_has_text(
        &bytes,
        "No issues were reported by this audit."
    ));

    let issue_bytes = decode_pdf(
        generate_audit_pdf(json!({
            "final_url": "https://example.test",
            "issues": [
                {"severity": "Critical", "category": "SEO", "message": "Bad title"},
                {"severity": null, "category": null, "message": null},
                {}
            ]
        }))
        .unwrap(),
    );
    assert!(pdf_has_text(&issue_bytes, "Bad title"));
    assert!(pdf_has_text(&issue_bytes, "Critical (1)"));
    assert!(pdf_has_text(&issue_bytes, "SEO"));
    assert!(pdf_has_text(&issue_bytes, "No description was provided"));
    assert!(pdf_has_text(&issue_bytes, "Info (2)"));
    assert!(pdf_has_text(&issue_bytes, "General"));
}

#[test]
fn generate_crawl_pdf_error_paths_and_fallbacks() {
    assert_eq!(
        generate_crawl_pdf(json!({})).unwrap_err(),
        "The crawl run has no scope URL to report."
    );
    assert_eq!(
        generate_crawl_pdf(json!({"scope_start_url": ""})).unwrap_err(),
        "The crawl run has no scope URL to report."
    );

    let bytes = decode_pdf(
        generate_crawl_pdf(json!({
            "scope_start_url": "https://example.test"
        }))
        .unwrap(),
    );
    assert!(bytes.starts_with(b"%PDF-1.4"));
    assert!(pdf_has_text(&bytes, "Site crawl report"));
    assert!(pdf_has_text(&bytes, "Not scored"));
    assert!(pdf_has_text(&bytes, "No issues were found"));

    let limited_bytes = decode_pdf(
        generate_crawl_pdf(json!({
            "scope_start_url": "https://example.test",
            "result": {
                "limit_reasons": ["depth_limit", "max_pages"],
                "discovery_provenance_truncated": true,
                "pages": []
            }
        }))
        .unwrap(),
    );
    assert!(pdf_has_text(
        &limited_bytes,
        "Limits reached: depth_limit, max_pages."
    ));
    assert!(pdf_has_text(&limited_bytes, "Discovery provenance partial"));
}

#[test]
fn generate_crawl_pdf_individual_template_sections() {
    let payload = json!({
        "scope_start_url": "https://example.test",
        "result": {
            "pages": [{
                "url": "https://example.test",
                "final_url": "https://example.test",
                "issues": [{"severity": "Warning", "message": "Alt missing"}],
                "links": [{"target_url": "https://example.test/about", "is_internal": true}],
                "images": [{"src": "img.png"}]
            }],
            "resources": [{"url": "https://example.test/style.css", "resource_type": "css"}]
        }
    });

    let mut resources_only = payload.clone();
    resources_only["report_template_sections"] = json!(["resources"]);
    let res_bytes = decode_pdf(generate_crawl_pdf(resources_only).unwrap());
    assert!(pdf_has_text(&res_bytes, "https://example.test/style.css"));
    assert!(!pdf_has_text(&res_bytes, "All crawled pages"));
    assert!(!pdf_has_text(&res_bytes, "What to fix first"));

    let mut links_only = payload.clone();
    links_only["report_template_sections"] = json!(["links"]);
    let links_bytes = decode_pdf(generate_crawl_pdf(links_only).unwrap());
    assert!(pdf_has_text(&links_bytes, "External links summary"));
    assert!(!pdf_has_text(&links_bytes, "Image problems"));

    let mut none_only = payload;
    none_only["report_template_sections"] = json!([]);
    let none_bytes = decode_pdf(generate_crawl_pdf(none_only).unwrap());
    for hidden in [
        "All crawled pages",
        "What to fix first",
        "Broken links",
        "Image problems",
        "Frames (iframes)",
    ] {
        assert!(!pdf_has_text(&none_bytes, hidden), "unexpected {hidden}");
    }
    assert!(pdf_has_text(&none_bytes, "Report coverage"));
}
