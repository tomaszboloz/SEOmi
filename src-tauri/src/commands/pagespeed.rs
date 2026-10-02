use crate::utils::provider_json::{read_provider_json, REPORT_JSON_LIMIT};
use mapping::map_pagespeed_response;
use serde_json::{json, Value};
use std::time::Duration;
use validation::{google_metrics_key, target_url, validate_form_factor, validate_strategy};

mod images;
mod mapping;
mod metrics;
mod touch;
mod validation;

const PAGESPEED_ENDPOINT: &str = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CRUX_ENDPOINT: &str = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";
const FIELD_METRICS: [&str; 5] = [
    "largest_contentful_paint",
    "interaction_to_next_paint",
    "cumulative_layout_shift",
    "first_contentful_paint",
    "experimental_time_to_first_byte",
];
async fn response_json(response: reqwest::Response) -> Result<Value, String> {
    read_provider_json(response, REPORT_JSON_LIMIT, "Google performance API").await
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
#[path = "pagespeed/image_tests.rs"]
mod image_tests;
#[cfg(test)]
#[path = "pagespeed/mapping_tests.rs"]
mod mapping_tests;
#[cfg(test)]
#[path = "pagespeed/touch_tests.rs"]
mod touch_tests;
#[cfg(test)]
#[path = "pagespeed/transport_tests.rs"]
mod transport_tests;
#[cfg(test)]
#[path = "pagespeed/validation_tests.rs"]
mod validation_tests;

#[cfg(test)]
#[path = "pagespeed/metric_tests.rs"]
mod metric_tests;
