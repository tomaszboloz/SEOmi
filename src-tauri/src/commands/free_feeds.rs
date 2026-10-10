#[path = "free_feeds_network.rs"]
mod network;
#[path = "free_feeds_urls.rs"]
mod urls;
use network::fetch_public_feed_at;
use reqwest::{redirect::Policy, Client};
use serde::Serialize;
use urls::public_feed_url;

const MAX_PUBLIC_FEED_BYTES: usize = 1_048_576;
const PUBLIC_FEED_TIMEOUT_SECS: u64 = 15;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicFeedResponse {
    pub status: String,
    pub source_url: String,
    pub fetched_at: String,
    pub body: Option<String>,
    pub http_status: Option<u16>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn fetch_public_feed(
    feed: String,
    geo: String,
    keyword: String,
    language: String,
) -> Result<PublicFeedResponse, String> {
    let url = public_feed_url(&feed, geo.trim(), &keyword, language.trim())?;
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(PUBLIC_FEED_TIMEOUT_SECS))
        .redirect(Policy::none())
        .build()
        .map_err(|_| "Unable to create public feed client.".to_string())?;
    Ok(fetch_public_feed_at(&client, url).await)
}

#[cfg(test)]
#[path = "free_feeds_contract_tests.rs"]
mod contract_tests;

#[cfg(test)]
#[path = "free_feeds_fixture.rs"]
mod fixture;
