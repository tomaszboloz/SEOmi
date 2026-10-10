use super::{generate_audit_pdf, generate_crawl_pdf};
use base64::Engine;
use serde_json::json;

fn decode_pdf(encoded: String) -> (Vec<u8>, String) {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .unwrap();
    let text = String::from_utf8_lossy(&bytes).to_string();
    (bytes, text)
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

    let (bytes, text) =
        decode_pdf(generate_audit_pdf(json!({"final_url": "https://example.test"})).unwrap());
    assert!(bytes.starts_with(b"%PDF-1.4"));
    assert!(text.contains("Audited URL: https://example.test"));
    assert!(text.contains("No issues were reported by this audit."));

    let (_, issue_text) = decode_pdf(
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
    assert!(issue_text.contains("[Critical] SEO: Bad title"));
    assert!(issue_text.contains("[Info] Technical: -"));
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

    let (_, text) = decode_pdf(
        generate_crawl_pdf(json!({
            "scope_start_url": "https://example.test"
        }))
        .unwrap(),
    );
    assert!(text.contains("Pages crawled: -"));
    assert!(text.contains("Health score: - / 100"));
    assert!(text.contains("No page records were present in this crawl run."));

    let (_, limited_text) = decode_pdf(
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
    assert!(limited_text.contains("Limits observed: depth_limit, max_pages"));
    assert!(limited_text.contains("Discovery provenance: partial at the configured safety cap."));
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
    let (_, res_text) = decode_pdf(generate_crawl_pdf(resources_only).unwrap());
    assert!(res_text.contains("Resources table \\(all saved resources\\):"));
    assert!(!res_text.contains("Pages table \\(all saved pages\\):"));
    assert!(!res_text.contains("Issues table \\(all saved findings\\):"));

    let mut links_only = payload.clone();
    links_only["report_template_sections"] = json!(["links"]);
    let (_, links_text) = decode_pdf(generate_crawl_pdf(links_only).unwrap());
    assert!(links_text.contains("Links table \\(all saved page links\\):"));
    assert!(!links_text.contains("Images table \\(all saved page images\\):"));

    let mut none_only = payload;
    none_only["report_template_sections"] = json!([]);
    let (_, none_text) = decode_pdf(generate_crawl_pdf(none_only).unwrap());
    assert!(!none_text.contains("Pages table"));
    assert!(!none_text.contains("Issues table"));
    assert!(!none_text.contains("Links table"));
    assert!(!none_text.contains("Images table"));
    assert!(!none_text.contains("Resources table"));
}
