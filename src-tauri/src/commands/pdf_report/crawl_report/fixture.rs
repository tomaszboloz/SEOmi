use serde_json::{json, Value};

const TITLES: [&str; 5] = [
    "Zażółć gęślą jaźń: sklep",
    "Привет, мир: каталог",
    "你好世界 目录",
    "مرحبا بالعالم الكتالوج",
    "Product page",
];

const MESSAGES: [(&str, &str); 6] = [
    ("Warning", "Missing meta description"),
    ("Warning", "Missing canonical link"),
    ("Info", "Document has no html lang attribute"),
    ("Critical", "HTTP error status 404"),
    (
        "Warning",
        "Title length is 15 characters; reference range is 30–60",
    ),
    ("Info", "3 image(s) missing alt text"),
];

/// A saved-run record like the frontend sends it, with `count` pages.
pub(super) fn synthetic(count: usize) -> Value {
    let pages: Vec<Value> = (0..count).map(page).collect();
    json!({
        "id": "run-synthetic", "completed_at": "2026-10-13T17:30:39Z",
        "scope_start_url": "https://shop.example.test/", "environment": "staging",
        "configuration": {"maxPages": count, "respectRobots": true, "includePatterns": [], "excludePatterns": ["/admin"], "crawlMode": "http"},
        "result": {
            "start_url": "https://shop.example.test/", "pages_crawled": count, "health_score": 41,
            "score_version": 2, "critical_count": 12, "warning_count": 90, "notice_count": 40,
            "duration_ms": 125_000, "cancelled": false, "timed_out": true, "limit_reasons": ["max_pages"],
            "robots_txt_status": "Loaded 2 rules", "robots_txt_evaluation_status": "loaded",
            "robots_txt_status_code": 200, "robots_blocked_count": 3, "sitemap_status": "Loaded 1 sitemap",
            "sitemap_urls_discovered": 2, "sitemap_urls": ["https://shop.example.test/a", "https://shop.example.test/b"],
            "robots_applicable_rules": [{"directive": "Disallow", "path": "/admin"}],
            "robots_agent_matrix": [{"user_agent": "SEOmi", "specific_group": false, "applicable_rules": [{"directive": "Disallow", "path": "/admin"}], "crawl_delay_ms": 500}],
            "robots_sitemap_directives": ["https://shop.example.test/sitemap.xml"],
            "robots_txt_redirect_chain": [{"from_url": "http://shop.example.test/robots.txt", "http_status": 301, "to_url": "https://shop.example.test/robots.txt"}],
            "rejected_urls": [{"url": "https://other.test/", "reason": "outside scope"}],
            "resources": (0..30).map(|i| json!({"url": format!("https://shop.example.test/app-{i}.js"), "resource_type": "script", "http_status": 200, "content_type": "text/javascript", "content_length": 1000 + i, "source_urls": ["https://shop.example.test/"]})).collect::<Vec<_>>(),
            "pages": pages,
        }
    })
}

fn page(i: usize) -> Value {
    let url = if i.is_multiple_of(17) {
        format!(
            "https://shop.example.test/{}/page-{i}?ref={}",
            "category/".repeat(8),
            "x".repeat(60)
        )
    } else {
        format!("https://shop.example.test/section-{}/page-{i}", i % 7)
    };
    let status = [200, 200, 200, 404, 200, 500, 200][i % 7];
    let issues: Vec<Value> = (0..(i % 4))
        .map(|k| {
            let (severity, message) = MESSAGES[(i + k) % MESSAGES.len()];
            json!({"severity": severity, "message": message})
        })
        .chain(i.is_multiple_of(5).then(|| json!({"severity": "Warning", "message": format!("Custom check {} failed: detail", i % 60)})))
        .collect();
    let relation = ["self", "missing", "different-host"][i % 3];
    json!({
        "url": url, "final_url": url, "depth": i % 4, "http_status": status, "response_time_ms": 100 + i % 900,
        "title": if i.is_multiple_of(9) { "Duplicate".into() } else { format!("{} {i}", TITLES[i % 5]) },
        "meta_description": if i.is_multiple_of(4) { Value::Null } else { json!(format!("Description {}", i % 20)) },
        "canonical": if i.is_multiple_of(6) { json!("https://other.test/") } else { Value::Null },
        "canonical_relation": relation, "canonical_declaration_count": 1,
        "word_count": 50 + i, "h1_count": i % 3, "indexability_status": if i.is_multiple_of(11) { "Blocked by robots.txt" } else { "Eligible from this response only" },
        "redirect_chain": (0..(i % 4)).map(|h| json!({"from_url": format!("{url}/{h}"), "http_status": 301, "to_url": url})).collect::<Vec<_>>(),
        "links": [{"target_url": "https://shop.example.test/", "anchor_text": "Home", "is_internal": true, "target_http_status": if i.is_multiple_of(5) { 404 } else { 200 }},
                  {"target_url": format!("https://ext{}.test/x", i % 3), "anchor_text": "Ext", "is_internal": false, "target_http_status": 200}],
        "images": [{"src": format!("{url}/img.png"), "lazy_loaded": false, "content_length": 500_000, "alt": if i.is_multiple_of(2) { Value::Null } else { json!("ok") }}],
        "hreflangs": i.is_multiple_of(8).then(|| json!({"language": "pl", "target_url": "https://shop.example.test/pl", "target_http_status": 404, "reciprocal_in_run": false})).into_iter().collect::<Vec<_>>(),
        "schema_types": if i.is_multiple_of(2) { json!(["Product"]) } else { json!([]) }, "schema_syntax_errors": i % 10 / 9,
        "issues": issues, "issues_count": i % 4,
    })
}
