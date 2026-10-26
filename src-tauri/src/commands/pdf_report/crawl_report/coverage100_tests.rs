use super::{crawl_pdf, data::Crawl, fixture::synthetic, sec_media, sec_schema};
use crate::commands::pdf_report::tests::extract_pdf_text;
use serde_json::{json, Value};

fn edge_run() -> Value {
    let mut run = synthetic(1);
    let page = &mut run["result"]["pages"][0];
    page["canonical_relation"] = json!("different-host");
    page["canonical_robots_conflict"] = json!(true);
    page["canonical_targets"] = json!([{"url": "https://other.test", "http_status": 404}]);
    page["redirect_stop_reason"] = json!("loop");
    page["redirect_chain"] = json!([{"http_status": 301, "to_url": "https://e.test/"}]);
    page["images"] = json!([
        {"src": "no-alt.png", "width": 1, "height": 2, "http_status": 200},
        {"src": "failed.png", "alt": "ok", "width": 1, "height": 2, "request_error_kind": "timeout"},
        {"src": "large.png", "alt": "ok", "width": 1, "height": 2, "content_length": 300000},
        {"src": "missing-height.png", "alt": "ok", "width": 1}
    ]);
    page["links"] = json!([
        {"target_url": "/broken", "is_internal": true, "target_http_status": 404},
        {"target_url": "https://ext.test/ok", "is_internal": false, "target_http_status": 200},
        {"target_url": "https://ext.test/fail", "is_internal": false, "target_request_error_kind": "timeout"},
        {"target_url": "https://ext.test/busy", "is_internal": false,
            "target_http_status": 503, "target_request_error_kind": "timeout"}
    ]);
    page["frames"] = json!([{ "src": "https://frame.test" }]);
    page["custom_search_results"] = json!([{ "id": "q", "values": ["one"], "error": "none" }]);
    page["html_validation_findings"] = json!([
        {"severity": "warning", "code": "x", "message": "m", "element": "div"},
        {"severity": "info", "code": "y", "message": "n", "element": "span", "line": 2, "column": 3}
    ]);
    page["schema_validation_findings"] = json!([{"format": "json-ld", "declaration_index": 0,
        "finding": {"path": "$.name", "message": "missing"}}]);
    run["result"]["cancelled"] = json!(true);
    run["result"]["robots_txt_warning"] = json!("robots unavailable");
    run["focus"] = json!({
        "score": 62, "band": "moderate", "confidence": 70, "on_topic_ratio": 80, "page_count": 1,
        "core_topic": {"label": "seo", "terms": [{"term": "seo", "coverage_pct": 50}]},
        "flags": {"multi_topic": true, "lexical_fallback": true, "degraded": true, "skipped_render_timeouts": 1},
        "counts": {"scored": 1, "skipped": 0, "off_topic": 0, "borderline": 0, "strong": 1},
        "pages": [{"url": "https://e.test/", "type": "article", "trs": 50, "similarity": 30,
            "overlap": 20, "drift": 70, "status": "moderate", "playbook": {"type": "A", "options": [{"code": "unknown", "params": {}}]}}],
        "recommendations": [], "sub_sites": [], "gaps": []
    });
    run["authority"] = json!({
        "tas": 45, "quadrant": "weak", "pillars": {"tcr": 50}, "warnings": ["unknown"],
        "pillar_coverage": [{"label": "Trust", "coverage_pct": 50, "gaps": 1}],
        "gaps": [{"label": "Topic", "level": "weak", "weight": 10}],
        "cannibalization": [{"canonical": "https://e.test/", "pages": 2, "similarity": 80}],
        "recommendations": [{"code": "unknown", "params": {}, "gain": 1}],
        "benchmark": [{"domain": "other.test", "sfs": 40, "tas": 50}]
    });
    run["aio"] = json!({
        "score": 55, "band": "moderate", "self_containment": 50, "spo_density": 60,
        "extractability": 70, "scored": 1, "skipped": 0, "basic_rule_languages": ["en"],
        "pages": [{"url": "https://e.test/", "score": 70, "self_containment": 50, "spo_density": 60, "extractability": 70, "chunks": 1}],
        "passages": [{"url": "https://e.test/", "heading": "H", "score": 40, "excerpt": "text", "issues": ["unknown"]}]
    });
    run["trust"] = json!({
        "score": 45, "level": "weak", "layers": {"schema_graph": 50}, "article_count": 1, "page_count": 1,
        "counts": {"authors": 1, "authors_with_same_as": 0}, "ymyl": "health", "ymyl_unattributed_pct": 5,
        "findings": [{"severity": "warning", "code": "unknown", "params": {}}],
        "authors": [{"generic": true, "name": "Author", "articles": 1, "same_as": null, "alignment": null}],
        "pages": {"about": "https://e.test/about"}
    });
    run
}

#[test]
fn crawl_edges_render_all_optional_sections_and_table_shapes() {
    let run = edge_run();
    let crawl = Crawl::new(&run);
    assert!(!sec_media::image_problems(&json!({"width": 1, "height": 2})).is_empty());
    assert!(!sec_media::image_problems(&json!({"alt": "ok", "width": 1})).is_empty());
    assert!(!sec_schema::structured_data(&crawl).rows.is_empty());
    let bytes = crawl_pdf(&run);
    assert!(bytes.starts_with(b"%PDF-1.4"));
    for tas in [95, 80, 65, 45, 20] {
        let mut band_run = run.clone();
        band_run["authority"]["tas"] = json!(tas);
        let _ = crawl_pdf(&band_run);
    }
    let mut fair_run = run.clone();
    fair_run["result"]["health_score"] = json!(65);
    let fair_label = super::strings::t(super::strings::report::RATING_FAIR);
    assert!(extract_pdf_text(&crawl_pdf(&fair_run)).contains(fair_label));
    let mut strong_trust = run["trust"].clone();
    strong_trust["layers"]["schema_graph"] = json!(75);
    assert_eq!(super::sec_trust::kpis(&strong_trust)[0].value, "75");
    let text = extract_pdf_text(&bytes);
    for part in [
        "Site Focus",
        "Topical Authority",
        "AI Overviews",
        "Entity Trust",
        "robots unavailable",
    ] {
        assert!(text.contains(part), "missing {part}");
    }
}
