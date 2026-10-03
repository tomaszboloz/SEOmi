use super::map_pagespeed_response;
use serde_json::json;
#[test]
fn maps_mobile_touch_target_audit_and_bounded_element_evidence() {
    let items = (0..52)
        .map(|index| {
            json!({
                "node": {
                    "nodeLabel": format!("Link {index}"),
                    "selector": format!("a:nth-child({index})"),
                    "snippet": "<a href=\"/page\">Link</a>"
                },
                "target": "24x24",
                "boundingRect": { "width": 24, "height": 24 },
                "failureSummary": "Tap target is too small"
            })
        })
        .collect::<Vec<_>>();
    let report = map_pagespeed_response(
        json!({
            "lighthouseResult": {
                "categories": {
                    "accessibility": { "score": 0.72, "auditRefs": [{ "id": "target-size" }] }
                },
                "audits": {
                    "target-size": {
                        "title": "Target size",
                        "description": "Tap targets are too small or too close together.",
                        "score": 0,
                        "scoreDisplayMode": "binary",
                        "displayValue": "52 targets are too small",
                        "details": { "items": items }
                    }
                }
            }
        }),
        "https://example.com/",
        "mobile",
    )
    .unwrap();

    assert_eq!(report["touchTargetAudit"]["id"], "target-size");
    assert_eq!(report["touchTargetAudit"]["score"], 0.0);
    assert_eq!(report["touchTargetAudit"]["evidenceCount"], 52);
    assert_eq!(
        report["touchTargetAudit"]["evidence"]
            .as_array()
            .unwrap()
            .len(),
        50
    );
    assert_eq!(
        report["touchTargetAudit"]["evidence"][0]["selector"],
        "a:nth-child(0)"
    );
    assert_eq!(report["touchTargetAudit"]["evidenceTruncated"], true);
}
