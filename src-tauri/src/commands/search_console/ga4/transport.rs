use crate::utils::provider_json::{read_provider_json, REPORT_JSON_LIMIT};
use serde_json::Value;

pub(super) async fn get_json(
    client: &reqwest::Client,
    token: &str,
    endpoint: &str,
    query: &[(&str, String)],
    provider: &'static str,
) -> Result<Value, String> {
    let mut request = client.get(endpoint).bearer_auth(token);
    if !query.is_empty() {
        request = request.query(query);
    }
    let response = request
        .send()
        .await
        .map_err(|_| format!("{provider} request failed."))?;
    read_provider_json(response, REPORT_JSON_LIMIT, provider).await
}

pub(super) async fn post_json(
    client: &reqwest::Client,
    token: &str,
    endpoint: &str,
    payload: &Value,
    provider: &'static str,
) -> Result<Value, String> {
    let response = client
        .post(endpoint)
        .bearer_auth(token)
        .json(payload)
        .send()
        .await
        .map_err(|_| format!("{provider} request failed."))?;
    read_provider_json(response, REPORT_JSON_LIMIT, provider).await
}

pub(super) fn api_endpoint(base: &str, resource: &str) -> String {
    let base = base.trim_end_matches('/');
    if base.ends_with("/v1beta") {
        format!("{base}/{resource}")
    } else {
        format!("{base}/v1beta/{resource}")
    }
}
