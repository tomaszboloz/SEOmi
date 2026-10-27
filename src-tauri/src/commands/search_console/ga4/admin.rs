use super::{
    account::account_candidates,
    models::{Ga4Discovery, Ga4Property},
    streams::stream_candidates,
    transport::api_endpoint,
    validation::{access_token, site_scope, MAX_PROPERTIES},
};
use reqwest::Client;

pub(super) const ACCOUNT_SUMMARIES_ENDPOINT: &str =
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries";
pub(super) const ADMIN_API_BASE: &str = "https://analyticsadmin.googleapis.com";

pub(super) async fn discover_at(
    client: &Client,
    token: &str,
    site_url: &str,
    account_endpoint: &str,
    admin_base: &str,
) -> Result<Ga4Discovery, String> {
    let token = access_token(token)?;
    let scope = site_scope(site_url)?;
    let (candidates, account_pages, mut truncated) =
        account_candidates(client, token, account_endpoint).await?;
    let candidates_checked = candidates.len().min(MAX_PROPERTIES);
    if candidates.len() > MAX_PROPERTIES {
        truncated = true;
    }
    let mut matches = Vec::new();
    let mut stream_pages = 0;
    for candidate in candidates.into_iter().take(MAX_PROPERTIES) {
        let endpoint = api_endpoint(admin_base, &format!("{}/dataStreams", candidate.property));
        let (streams, pages, stream_truncated) =
            stream_candidates(client, token, &endpoint, &scope).await?;
        stream_pages += pages;
        truncated |= stream_truncated;
        matches.extend(
            streams
                .into_iter()
                .map(|stream| (candidate.clone(), stream)),
        );
    }
    let match_count = matches.len();
    let property = if match_count == 1 {
        matches.pop().map(|(candidate, stream)| Ga4Property {
            name: candidate.property,
            display_name: candidate.display_name,
            stream_urls: vec![stream.default_uri.clone()],
            selected_host_name: stream.host_name,
        })
    } else {
        None
    };
    let status = match (property.is_some(), truncated || match_count > 1) {
        (true, true) => super::models::Ga4Status::Partial,
        (true, false) => super::models::Ga4Status::Complete,
        (false, true) => super::models::Ga4Status::Partial,
        (false, false) => super::models::Ga4Status::Missing,
    };
    Ok(Ga4Discovery {
        status,
        property,
        account_pages,
        stream_pages,
        candidates_checked,
        may_be_truncated: truncated || match_count > 1,
    })
}
