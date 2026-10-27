use super::{
    images::map_image_optimization_audits, touch::map_touch_target_audit, validation::target_url,
};
use serde_json::json;

#[test]
fn image_audits_map_direct_nodes_and_bound_evidence() {
    let items = (0..51)
        .map(|index| {
            if index == 0 {
                json!({
                    "resource": "https://example.com/hero.jpg",
                    "nodeLabel": "Hero image",
                    "selector": "img.hero",
                    "snippet": "<img class=hero>",
                    "totalBytes": 100,
                    "wastedBytes": 25,
                    "wastedPercent": 25
                })
            } else {
                json!({ "url": format!("https://example.com/{index}.jpg") })
            }
        })
        .collect::<Vec<_>>();
    let categories = json!({
        "performance": { "auditRefs": [
            {},
            { "id": "unknown-audit" },
            { "id": "modern-image-formats" },
            { "id": "uses-optimized-images" }
        ] }
    });
    let audits = json!({
        "uses-optimized-images": {
            "details": { "nodes": items }
        }
    });

    let mapped = map_image_optimization_audits(&categories, &audits);
    assert_eq!(mapped.len(), 1);
    assert_eq!(mapped[0]["evidenceCount"], 51);
    assert_eq!(mapped[0]["evidence"].as_array().unwrap().len(), 50);
    assert_eq!(
        mapped[0]["evidence"][0]["url"],
        "https://example.com/hero.jpg"
    );
    assert_eq!(mapped[0]["evidence"][0]["selector"], "img.hero");
    assert_eq!(mapped[0]["evidenceTruncated"], true);
}

#[test]
fn touch_audit_prefers_known_ids_and_supports_nodes_fallback() {
    let preferred = map_touch_target_audit(
        &json!({ "accessibility": { "auditRefs": [
            { "id": "target_size" }, { "id": "tap-targets" }
        ] } }),
        &json!({ "tap-targets": { "title": 7 } }),
    );
    assert_eq!(preferred["id"], "tap-targets");
    assert!(preferred["evidence"].as_array().unwrap().is_empty());
    assert_eq!(preferred["title"], "tap-targets");

    let fallback = map_touch_target_audit(
        &json!({ "accessibility": { "auditRefs": [{ "id": "target_size" }] } }),
        &json!({ "target_size": {
            "details": { "nodes": [{
                "target": "button",
                "targetSize": { "width": 20, "height": 20 }
            }] }
        } }),
    );
    assert_eq!(fallback["id"], "target_size");
    assert_eq!(fallback["evidenceCount"], 1);
    assert_eq!(fallback["evidence"][0]["target"], "button");
    assert!(fallback["evidence"][0]["label"].is_null());
}

#[test]
fn target_url_rejects_a_password_when_username_is_empty() {
    assert!(target_url("https://:secret@example.com/private").is_err());
    assert_eq!(
        target_url("example.com/private").unwrap().as_str(),
        "https://example.com/private"
    );
    let normalized = target_url("https://example.com/private#section").unwrap();
    assert_eq!(normalized.as_str(), "https://example.com/private");
}
