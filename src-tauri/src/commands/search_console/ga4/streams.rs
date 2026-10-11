use super::{
    mapping::{matching_streams, stream_page},
    models::Ga4StreamEvidence,
    transport::get_json,
    validation::{next_page_token, SiteScope, MAX_PAGES, PAGE_SIZE},
};
use reqwest::Client;

pub(super) async fn stream_candidates(
    client: &Client,
    token: &str,
    endpoint: &str,
    scope: &SiteScope,
) -> Result<(Vec<Ga4StreamEvidence>, usize, bool), String> {
    let mut streams = Vec::new();
    let mut page_token = None;
    let mut pages = 0;
    let mut truncated = false;
    for index in 0..MAX_PAGES {
        pages += 1;
        let mut query = vec![("pageSize", PAGE_SIZE.to_string())];
        if let Some(next) = page_token.clone() {
            query.push(("pageToken", next));
        }
        let page = stream_page(
            get_json(
                client,
                token,
                endpoint,
                &query,
                "Google Analytics Admin API",
            )
            .await?,
        )?;
        streams.extend(matching_streams(&page, scope)?);
        let next = next_page_token(page.next_page_token)?;
        if page_token
            .as_ref()
            .is_some_and(|current| next.as_ref() == Some(current))
        {
            return Ok((streams, pages, true));
        }
        page_token = next;
        if page_token.is_none() {
            break;
        }
        if index + 1 == MAX_PAGES {
            truncated = true;
        }
    }
    Ok((streams, pages, truncated))
}
