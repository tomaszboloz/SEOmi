use super::map_pagespeed_response;
use serde_json::json;
#[test]
fn maps_image_optimization_savings_and_source_evidence_without_estimating_them() {
    let report = map_pagespeed_response(
            json!({
                "lighthouseResult": {
                    "categories": {
                        "performance": { "auditRefs": [
                            { "id": "modern-image-formats" },
                            { "id": "uses-responsive-images" }
                        ] }
                    },
                    "audits": {
                        "modern-image-formats": {
                            "title": "Serve images in next-gen formats",
                            "description": "Image formats can reduce transfer size.",
                            "score": 0,
                            "scoreDisplayMode": "binary",
                            "displayValue": "Potential savings of 42 KiB",
                            "details": {
                                "overallSavingsBytes": 43008,
                                "items": [{
                                    "url": "https://example.com/hero.jpg",
                                    "totalBytes": 102400,
                                    "wastedBytes": 43008,
                                    "wastedPercent": 42,
                                    "node": { "nodeLabel": "Hero image", "selector": "img.hero", "snippet": "<img class=hero>" }
                                }]
                            }
                        },
                        "uses-responsive-images": {
                            "title": "Properly size images",
                            "score": null,
                            "scoreDisplayMode": "notApplicable"
                        }
                    }
                }
            }),
            "https://example.com/",
            "mobile",
        )
        .unwrap();

    let audits = report["imageOptimizationAudits"].as_array().unwrap();
    assert_eq!(audits.len(), 2);
    assert_eq!(audits[0]["overallSavingsBytes"], 43008.0);
    assert_eq!(
        audits[0]["evidence"][0]["url"],
        "https://example.com/hero.jpg"
    );
    assert_eq!(audits[0]["evidence"][0]["wastedBytes"], 43008);
    assert!(audits[1]["score"].is_null());
    assert!(audits[1]["evidence"].as_array().unwrap().is_empty());
}
