use super::map_pagespeed_response;
use serde_json::json;
#[test]
fn maps_lighthouse_scores_and_metrics_without_inventing_missing_data() {
    let response = map_pagespeed_response(json!({
            "lighthouseResult": {
                "finalDisplayedUrl": "https://example.com/",
                "fetchTime": "2026-09-22T10:00:00.000Z",
                "lighthouseVersion": "12.0.0",
                "categories": { "performance": { "score": 0.83 }, "seo": { "score": 1.0 } },
                "audits": { "largest-contentful-paint": { "title": "Largest Contentful Paint", "displayValue": "2.3 s", "numericValue": 2300, "score": 0.75 } }
            }
        }), "https://example.com/", "mobile").unwrap();

    assert_eq!(response["categories"]["performance"], 83.0);
    assert_eq!(response["categories"]["seo"], 100.0);
    assert!(response["categories"]["accessibility"].is_null());
    assert_eq!(
        response["metrics"]["largest-contentful-paint"]["numericValue"],
        2300.0
    );
    assert!(response["touchTargetAudit"].is_null());
    assert!(response["fieldExperience"].is_null());
}

#[test]
fn no_report_errors_are_local_and_opportunities_are_bounded_to_recorded_failures() {
    for body in [
        json!({"error":{"message":"synthetic-secret"}}),
        json!({"lighthouseResult":42}),
    ] {
        assert_eq!(
            map_pagespeed_response(body, "https://example.com/", "mobile").unwrap_err(),
            "PageSpeed Insights returned no Lighthouse report."
        );
    }
    let refs = (0..25)
        .map(|i| json!({"id":format!("finding-{i}")}))
        .collect::<Vec<_>>();
    let audits = (0..25)
        .map(|i| (format!("finding-{i}"), json!({"score":0,"details":{}})))
        .collect::<serde_json::Map<_, _>>();
    let report = map_pagespeed_response(json!({"lighthouseResult":{"categories":{"performance":{"auditRefs":refs}},"audits":audits}}), "https://example.com/", "mobile").unwrap();
    assert_eq!(report["finalUrl"], "https://example.com/");
    assert!(report["categories"]["performance"].is_null());
    assert_eq!(report["opportunities"].as_array().unwrap().len(), 20);
    let report = map_pagespeed_response(json!({"lighthouseResult":{"categories":{"performance":{"auditRefs":[{}, {"id":"missing"}, {"id":"pass"}, {"id":"no-details"}]}},"audits":{"pass":{"score":0.9,"details":{}},"no-details":{"score":0}}}}), "https://example.com/", "mobile").unwrap();
    assert!(report["opportunities"].as_array().unwrap().is_empty());
}
