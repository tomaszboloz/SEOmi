use super::{
    images::map_image_optimization_audits, metrics::audit_metric, touch::map_touch_target_audit,
};
use serde_json::{json, Value};

pub(super) fn map_pagespeed_response(
    body: Value,
    requested_url: &str,
    strategy: &str,
) -> Result<Value, String> {
    let lighthouse = body
        .get("lighthouseResult")
        .filter(|value| value.is_object())
        .ok_or_else(|| "PageSpeed Insights returned no Lighthouse report.".to_string())?;
    let categories = lighthouse.get("categories").unwrap_or(&Value::Null);
    let audits = lighthouse.get("audits").unwrap_or(&Value::Null);
    let touch_target_audit = map_touch_target_audit(categories, audits);
    let image_optimization_audits = map_image_optimization_audits(categories, audits);
    let category_score = |name: &str| {
        categories
            .pointer(&format!("/{name}/score"))
            .and_then(Value::as_f64)
            .map(|score| (score * 100.0).round())
    };
    let metrics = [
        "first-contentful-paint",
        "largest-contentful-paint",
        "cumulative-layout-shift",
        "total-blocking-time",
        "speed-index",
        "interactive",
    ];
    let mapped_metrics: serde_json::Map<String, Value> = metrics
        .iter()
        .filter_map(|id| {
            audit_metric(audits, id)
                .as_object()
                .map(|metric| ((*id).to_string(), Value::Object(metric.clone())))
        })
        .collect();

    let opportunities: Vec<Value> = lighthouse
        .pointer("/categories/performance/auditRefs")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|reference| {
            let id = reference.get("id")?.as_str()?;
            let audit = audits.get(id)?;
            let score = audit.get("score").and_then(Value::as_f64);
            if score.is_some_and(|value| value >= 0.9) || audit.get("details").is_none() {
                return None;
            }
            Some(json!({
                "id": id,
                "title": audit.get("title").and_then(Value::as_str).unwrap_or(id),
                "description": audit.get("description").and_then(Value::as_str).unwrap_or(""),
                "displayValue": audit.get("displayValue").and_then(Value::as_str),
                "score": score,
            }))
        })
        .take(20)
        .collect();

    Ok(json!({
        "source": "Google PageSpeed Insights API / Lighthouse",
        "requestedUrl": requested_url,
        "finalUrl": lighthouse.get("finalDisplayedUrl").and_then(Value::as_str).unwrap_or(requested_url),
        "strategy": strategy,
        "fetchedAt": lighthouse.get("fetchTime").and_then(Value::as_str),
        "lighthouseVersion": lighthouse.get("lighthouseVersion").and_then(Value::as_str),
        "categories": {
            "performance": category_score("performance"),
            "accessibility": category_score("accessibility"),
            "bestPractices": category_score("best-practices"),
            "seo": category_score("seo"),
        },
        "metrics": mapped_metrics,
        "opportunities": opportunities,
        "touchTargetAudit": touch_target_audit,
        "imageOptimizationAudits": image_optimization_audits,
        "fieldExperience": body.get("loadingExperience"),
        "originExperience": body.get("originLoadingExperience"),
    }))
}
