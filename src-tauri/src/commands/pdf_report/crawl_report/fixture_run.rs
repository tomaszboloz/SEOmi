use serde_json::{json, Value};

fn page_one() -> Value {
    let mut page = json!({"url": "https://e.test/", "title": "Same", "meta_description": "D", "content_hash": "abcdef0123456789xyz",
        "http_status": 200, "depth": 0, "canonical_relation": "self", "final_url": "https://e.test/",
        "redirect_chain": [{"from_url": "http://e.test/", "http_status": 301, "to_url": "https://e.test/"}],
        "client_redirects": [{"source": "meta-refresh", "declaration": "0;url=/x", "target_url": "/x", "delay_seconds": 0}],
        "links": [{"target_url": "https://x.test/p", "anchor_text": "X", "is_internal": false, "target_http_status": 404},
            {"target_url": "/b", "is_internal": true, "target_request_error_kind": "timeout"},
            {"target_url": "https://x.test/q", "is_internal": false}],
        "images": [{"src": "i.png", "content_length": 300000, "http_status": 404}, {"src": "ok.png", "alt": "", "width": 1, "height": 1}]});
    let more = json!({
        "hreflangs": [{"language": "pl", "target_url": "https://e.test/pl", "target_http_status": 404, "reciprocal_in_run": false},
            {"language": "en", "target_url": "https://e.test/en", "reciprocal_in_run": true}],
        "pagination_links": [{"relation": "next", "target_url": "https://e.test/2", "http_status": 200, "query_parameter_changes": ["page"], "reciprocal_in_run": null}],
        "schema_types": ["Article"], "schema_syntax_errors": 1,
        "schema_validation_findings": [{"format": "json-ld", "declaration_index": 0, "finding": {"path": "$.a", "message": "bad"}}],
        "html_validation_findings": [{"severity": "warning", "code": "c1", "message": "m", "element": "div", "line": 3, "column": 4}]});
    let rest = json!({
        "frames": [{"resolved_url": "https://f.test/", "title": "F", "http_status": 200}],
        "custom_search_results": [{"id": "s", "values": ["v1", "v2"]}],
        "content_type": "text/html", "discovery_sources": [{"kind": "start"}], "amp_url": "https://e.test/amp",
        "indexability_verdict": {"status": "blocked", "reasons": ["robots.txt"]},
        "issues": [{"severity": "Critical", "message": "Boom"},
            {"severity": "Info", "message": "Near-duplicate content with https://e.test/b (local SimHash distance 3/64)"}]});
    for part in [more, rest] {
        page.as_object_mut()
            .unwrap()
            .extend(part.as_object().unwrap().clone());
    }
    page
}

pub(super) fn run() -> Value {
    let page_two = json!({"url": "https://e.test/b", "title": "Same", "content_hash": "abcdef0123456789xyz", "http_status": 404,
        "canonical_relation": "missing", "canonical_targets": [{"url": "https://c.test/", "http_status": null}],
        "redirect_stop_reason": "loop", "links": [{"target_url": "https://y.test/", "is_internal": false}], "meta_description": "D", "issues": []});
    let robots = json!({"robots_txt_warning": "w", "robots_applicable_rules": [{"directive": "Disallow", "path": "/x"}],
        "robots_agent_matrix": [{"user_agent": "UA", "specific_group": true, "applicable_rules": [{"directive": "Allow", "path": "/"}], "crawl_delay_ms": 5}],
        "robots_sitemap_directives": ["https://e.test/s.xml"], "sitemap_urls": ["https://e.test/s1"],
        "robots_txt_redirect_chain": [{"from_url": "http://e.test/robots.txt", "http_status": 301, "to_url": "https://e.test/robots.txt"}],
        "rejected_urls": [{"url": "https://o.test/", "reason": "scope"}]});
    let mut result = json!({"storage_pages_total": 9, "storage_pages_truncated": true, "pages_crawled": 2,
        "resources": [{"url": "https://e.test/a.js", "resource_type": "script", "source_urls": ["https://e.test/"]}],
        "pages": [page_one(), page_two]});
    result
        .as_object_mut()
        .unwrap()
        .extend(robots.as_object().unwrap().clone());
    json!({"id": "r", "scope_start_url": "https://e.test/", "result": result,
        "configuration": {"a": true, "b": [], "c": ["x", "y"], "d": null, "e": {"k": 1}, "f": 3, "g": "s"}})
}
