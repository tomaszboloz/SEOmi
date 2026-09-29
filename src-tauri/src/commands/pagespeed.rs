use crate::commands::settings::secret_entry;
use crate::utils::url_validator::validate_and_normalize_url;
use serde_json::{json, Value};
use std::time::Duration;
use url::Url;

const PAGESPEED_ENDPOINT: &str = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CRUX_ENDPOINT: &str = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";
const FIELD_METRICS: [&str; 5] = [
    "largest_contentful_paint",
    "interaction_to_next_paint",
    "cumulative_layout_shift",
    "first_contentful_paint",
    "experimental_time_to_first_byte",
];
const IMAGE_AUDIT_IDS: [&str; 5] = [
    "uses-optimized-images",
    "modern-image-formats",
    "uses-webp-images",
    "uses-responsive-images",
    "efficient-animated-content",
];

fn validate_project_id(project_id: &str) -> Result<(), String> {
    if project_id.is_empty()
        || project_id.len() > 80
        || !project_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err("Invalid project identifier for Google performance request.".into());
    }
    Ok(())
}

fn google_metrics_key(project_id: &str) -> Result<String, String> {
    validate_project_id(project_id)?;
    let entry = secret_entry(&format!("google_metrics_api_key_{project_id}"))?;
    let key = entry.get_password().map_err(|_| {
        "Add a Google PageSpeed Insights / CrUX API key in this project's Settings.".to_string()
    })?;
    if key.trim().is_empty() {
        return Err(
            "Google performance API key is empty. Configure it in this project's Settings.".into(),
        );
    }
    Ok(key)
}

fn target_url(input: &str) -> Result<Url, String> {
    if input.len() > 4_096 {
        return Err("Target URL cannot exceed 4096 characters.".into());
    }
    let mut target = validate_and_normalize_url(input).map_err(|error| error.to_string())?;
    if !target.username().is_empty() || target.password().is_some() {
        return Err("Target URL must not contain a username or password.".into());
    }
    target.set_fragment(None);
    Ok(target)
}

fn validate_strategy(strategy: &str) -> Result<&'static str, String> {
    match strategy {
        "mobile" => Ok("mobile"),
        "desktop" => Ok("desktop"),
        _ => Err("PageSpeed strategy must be mobile or desktop.".into()),
    }
}

fn validate_form_factor(form_factor: &str) -> Result<&'static str, String> {
    match form_factor {
        "PHONE" => Ok("PHONE"),
        "DESKTOP" => Ok("DESKTOP"),
        "TABLET" => Ok("TABLET"),
        _ => Err("CrUX form factor must be PHONE, DESKTOP, or TABLET.".into()),
    }
}

async fn response_json(response: reqwest::Response) -> Result<Value, String> {
    let status = response.status();
    let body = response
        .json::<Value>()
        .await
        .map_err(|_| "Google performance API returned an unreadable response.".to_string())?;
    if !status.is_success() {
        let message = body
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or("Google performance API request failed.");
        return Err(format!("Google performance API (HTTP {status}): {message}"));
    }
    Ok(body)
}

fn audit_metric(audits: &Value, id: &str) -> Value {
    let Some(audit) = audits.get(id) else {
        return Value::Null;
    };
    json!({
        "id": id,
        "title": audit.get("title").and_then(Value::as_str).unwrap_or(id),
        "displayValue": audit.get("displayValue").and_then(Value::as_str),
        "numericValue": audit.get("numericValue").and_then(Value::as_f64),
        "score": audit.get("score").and_then(Value::as_f64),
    })
}

fn short_text(value: Option<&Value>) -> Value {
    value
        .and_then(Value::as_str)
        .map(|text| {
            let shortened = text.chars().take(500).collect::<String>();
            Value::String(shortened)
        })
        .unwrap_or(Value::Null)
}

fn map_touch_target_evidence(item: &Value) -> Value {
    let node = item.get("node").unwrap_or(item);
    json!({
        "label": short_text(node.get("nodeLabel").or_else(|| item.get("nodeLabel"))),
        "selector": short_text(node.get("selector").or_else(|| item.get("selector"))),
        "snippet": short_text(node.get("snippet").or_else(|| item.get("snippet"))),
        "target": short_text(item.get("target")),
        "targetSize": item.get("targetSize").cloned().unwrap_or(Value::Null),
        "boundingRect": item.get("boundingRect").cloned().unwrap_or(Value::Null),
        "failureSummary": short_text(item.get("failureSummary")),
        "explanation": short_text(item.get("explanation")),
    })
}

fn map_touch_target_audit(categories: &Value, audits: &Value) -> Value {
    let Some(references) = categories
        .pointer("/accessibility/auditRefs")
        .and_then(Value::as_array)
    else {
        return Value::Null;
    };

    let candidate_ids = references
        .iter()
        .filter_map(|reference| reference.get("id").and_then(Value::as_str))
        .filter(|id| {
            let id = id.to_ascii_lowercase();
            id.contains("tap") || id.contains("target-size") || id.contains("target_size")
        })
        .collect::<Vec<_>>();

    let selected = ["target-size", "tap-targets", "tap-target-size"]
        .iter()
        .find_map(|id| candidate_ids.contains(id).then_some(*id))
        .or_else(|| candidate_ids.first().copied());
    let Some(id) = selected else {
        return Value::Null;
    };
    let Some(audit) = audits.get(id) else {
        return Value::Null;
    };
    let evidence = audit
        .pointer("/details/items")
        .or_else(|| audit.pointer("/details/nodes"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .take(50)
                .map(map_touch_target_evidence)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let total_evidence_count = audit
        .pointer("/details/items")
        .or_else(|| audit.pointer("/details/nodes"))
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or_default();

    json!({
        "id": id,
        "title": audit.get("title").and_then(Value::as_str).unwrap_or(id),
        "description": audit.get("description").and_then(Value::as_str).unwrap_or(""),
        "score": audit.get("score").and_then(Value::as_f64),
        "scoreDisplayMode": audit.get("scoreDisplayMode").and_then(Value::as_str),
        "displayValue": audit.get("displayValue").and_then(Value::as_str),
        "evidence": evidence,
        "evidenceCount": total_evidence_count,
        "evidenceTruncated": total_evidence_count > 50,
    })
}

fn map_image_optimization_audits(categories: &Value, audits: &Value) -> Vec<Value> {
    let Some(references) = categories
        .pointer("/performance/auditRefs")
        .and_then(Value::as_array)
    else {
        return Vec::new();
    };

    references
        .iter()
        .filter_map(|reference| reference.get("id").and_then(Value::as_str))
        .filter(|id| IMAGE_AUDIT_IDS.contains(id))
        .filter_map(|id| {
            let audit = audits.get(id)?;
            let items = audit
                .pointer("/details/items")
                .or_else(|| audit.pointer("/details/nodes"))
                .and_then(Value::as_array);
            let evidence = items
                .into_iter()
                .flatten()
                .take(50)
                .map(|item| {
                    let node = item.get("node").unwrap_or(item);
                    json!({
                        "url": short_text(item.get("url").or_else(|| item.get("resource"))),
                        "label": short_text(node.get("nodeLabel").or_else(|| item.get("nodeLabel"))),
                        "selector": short_text(node.get("selector").or_else(|| item.get("selector"))),
                        "snippet": short_text(node.get("snippet").or_else(|| item.get("snippet"))),
                        "totalBytes": item.get("totalBytes").cloned().unwrap_or(Value::Null),
                        "wastedBytes": item.get("wastedBytes").cloned().unwrap_or(Value::Null),
                        "wastedPercent": item.get("wastedPercent").cloned().unwrap_or(Value::Null),
                        "displayValue": short_text(item.get("displayValue")),
                    })
                })
                .collect::<Vec<_>>();
            let evidence_count = items.map(Vec::len).unwrap_or_default();

            Some(json!({
                "id": id,
                "title": audit.get("title").and_then(Value::as_str).unwrap_or(id),
                "description": audit.get("description").and_then(Value::as_str).unwrap_or(""),
                "score": audit.get("score").and_then(Value::as_f64),
                "scoreDisplayMode": audit.get("scoreDisplayMode").and_then(Value::as_str),
                "displayValue": audit.get("displayValue").and_then(Value::as_str),
                "overallSavingsBytes": audit.pointer("/details/overallSavingsBytes").and_then(Value::as_f64),
                "evidence": evidence,
                "evidenceCount": evidence_count,
                "evidenceTruncated": evidence_count > 50,
            }))
        })
        .collect()
}

fn map_pagespeed_response(
    body: Value,
    requested_url: &str,
    strategy: &str,
) -> Result<Value, String> {
    let lighthouse = body
        .get("lighthouseResult")
        .filter(|value| value.is_object())
        .ok_or_else(|| {
            body.pointer("/error/message")
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| "PageSpeed Insights returned no Lighthouse report.".to_string())
        })?;
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

#[tauri::command]
pub async fn run_pagespeed_insights(
    project_id: String,
    url: String,
    strategy: String,
) -> Result<Value, String> {
    let api_key = google_metrics_key(&project_id)?;
    let strategy = validate_strategy(&strategy)?;
    let target = target_url(&url)?;
    let target_string = target.to_string();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(150))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|_| "Unable to initialize the PageSpeed network client.".to_string())?;
    let response = client
        .get(PAGESPEED_ENDPOINT)
        .query(&[
            ("url", target_string.as_str()),
            ("key", api_key.as_str()),
            ("strategy", strategy),
            ("category", "performance"),
            ("category", "accessibility"),
            ("category", "best-practices"),
            ("category", "seo"),
        ])
        .send()
        .await
        .map_err(|_| {
            "Could not connect to Google PageSpeed Insights. Check your network and API quota."
                .to_string()
        })?;
    let body = response_json(response).await?;
    map_pagespeed_response(body, &target_string, strategy)
}

#[tauri::command]
pub async fn query_crux_record(
    project_id: String,
    url: String,
    form_factor: String,
    origin_scope: bool,
) -> Result<Value, String> {
    let api_key = google_metrics_key(&project_id)?;
    let form_factor = validate_form_factor(&form_factor)?;
    let target = target_url(&url)?;
    let target_string = if origin_scope {
        target.origin().ascii_serialization()
    } else {
        target.to_string()
    };
    let request_body = json!({
        if origin_scope { "origin" } else { "url" }: target_string,
        "formFactor": form_factor,
        "metrics": FIELD_METRICS,
    });
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|_| "Unable to initialize the CrUX network client.".to_string())?;
    let response = client
        .post(CRUX_ENDPOINT)
        .query(&[("key", api_key.as_str())])
        .json(&request_body)
        .send()
        .await
        .map_err(|_| {
            "Could not connect to the Chrome UX Report API. Check your network and API quota."
                .to_string()
        })?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(
            "CRUX_NOT_ENOUGH_DATA: Google has no sufficient real-user data for this URL or origin."
                .into(),
        );
    }
    response_json(response).await
}

#[cfg(test)]
mod tests {
    use super::{map_pagespeed_response, target_url, validate_form_factor, validate_strategy};
    use serde_json::json;

    #[test]
    fn accepts_only_supported_strategies_and_crux_form_factors() {
        assert_eq!(validate_strategy("mobile").unwrap(), "mobile");
        assert_eq!(validate_strategy("desktop").unwrap(), "desktop");
        assert!(validate_strategy("tablet").is_err());
        assert_eq!(validate_form_factor("PHONE").unwrap(), "PHONE");
        assert_eq!(validate_form_factor("DESKTOP").unwrap(), "DESKTOP");
        assert_eq!(validate_form_factor("TABLET").unwrap(), "TABLET");
        assert!(validate_form_factor("MOBILE").is_err());
    }

    #[test]
    fn validates_external_targets_and_strips_fragments() {
        assert_eq!(
            target_url("https://example.com/page#section")
                .unwrap()
                .as_str(),
            "https://example.com/page"
        );
        assert!(target_url("http://127.0.0.1/private").is_err());
        assert!(target_url("https://user:password@example.com").is_err());
    }

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
}
