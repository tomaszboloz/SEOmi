use super::{
    images::map_image_optimization_audits,
    metrics::{audit_metric, short_text},
    touch::map_touch_target_audit,
};
use serde_json::{json, Value};

#[test]
fn metrics_preserve_explicit_zero_and_absence_without_coercion() {
    assert!(audit_metric(&json!({}), "lcp").is_null());
    let metric = audit_metric(
        &json!({"lcp":{"score":0,"numericValue":0,"displayValue":42}}),
        "lcp",
    );
    assert_eq!(metric["title"], "lcp");
    assert_eq!(metric["score"], 0.0);
    assert_eq!(metric["numericValue"], 0.0);
    assert!(metric["displayValue"].is_null());
    assert!(short_text(None).is_null());
    assert!(short_text(Some(&json!(42))).is_null());
    let long = json!("ż".repeat(501));
    assert_eq!(
        short_text(Some(&long)).as_str().unwrap().chars().count(),
        500
    );
}

#[test]
fn missing_or_unreferenced_touch_audits_do_not_create_findings() {
    for categories in [
        Value::Null,
        json!({"accessibility":{"auditRefs":42}}),
        json!({"accessibility":{"auditRefs":[{}, {"id":"irrelevant"}]}}),
    ] {
        assert!(map_touch_target_audit(&categories, &json!({})).is_null());
    }
    assert!(map_touch_target_audit(
        &json!({"accessibility":{"auditRefs":[{"id":"tap-targets"}]}}),
        &json!({})
    )
    .is_null());
}

#[test]
fn touch_prefers_the_standard_audit_and_preserves_nodes_fallback_evidence() {
    let categories =
        json!({"accessibility":{"auditRefs":[{"id":"tap-custom"},{"id":"target-size"}]}});
    let audits = json!({"target-size":{"details":{"nodes":[{"nodeLabel":"fixture","selector":"a","targetSize":24}]}}});
    let result = map_touch_target_audit(&categories, &audits);
    assert_eq!(result["id"], "target-size");
    assert_eq!(result["title"], "target-size");
    assert_eq!(result["evidence"][0]["label"], "fixture");
    assert_eq!(result["evidence"][0]["targetSize"], 24);
    assert_eq!(result["evidenceCount"], 1);
    assert_eq!(result["evidenceTruncated"], false);
    let fallback = map_touch_target_audit(
        &json!({"accessibility":{"auditRefs":[{"id":"tap-custom"}]}}),
        &json!({"tap-custom":{}}),
    );
    assert_eq!(fallback["id"], "tap-custom");
    assert_eq!(fallback["evidenceCount"], 0);
}

#[test]
fn image_mapping_requires_a_referenced_supported_audit_and_bounds_nodes() {
    assert!(map_image_optimization_audits(&Value::Null, &Value::Null).is_empty());
    let categories = json!({"performance":{"auditRefs":[{}, {"id":"irrelevant"}, {"id":"uses-webp-images"}, {"id":"uses-optimized-images"}]}});
    let nodes = (0..51)
        .map(|_| json!({"resource":"image.webp","nodeLabel":"fixture"}))
        .collect::<Vec<_>>();
    let audits = json!({"uses-webp-images":{"details":{"nodes":nodes}}});
    let mapped = map_image_optimization_audits(&categories, &audits);
    assert_eq!(mapped.len(), 1);
    assert_eq!(mapped[0]["title"], "uses-webp-images");
    assert_eq!(mapped[0]["evidenceCount"], 51);
    assert_eq!(mapped[0]["evidenceTruncated"], true);
    assert_eq!(mapped[0]["evidence"].as_array().unwrap().len(), 50);
    assert_eq!(mapped[0]["evidence"][0]["url"], "image.webp");
}
