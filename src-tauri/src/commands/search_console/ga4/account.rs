use super::{
    mapping::account_page,
    models::AccountSummary,
    transport::get_json,
    validation::{next_page_token, property_name, MAX_PAGES, PAGE_SIZE},
};
use reqwest::Client;
use std::collections::HashSet;

#[derive(Clone, Debug)]
pub(super) struct PropertyCandidate {
    pub(super) property: String,
    pub(super) display_name: Option<String>,
}

pub(super) async fn account_candidates(
    client: &Client,
    token: &str,
    endpoint: &str,
) -> Result<(Vec<PropertyCandidate>, usize, bool), String> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();
    let mut page_token = None;
    let mut pages = 0;
    let mut truncated = false;
    for index in 0..MAX_PAGES {
        pages += 1;
        let mut query = vec![("pageSize", PAGE_SIZE.to_string())];
        if let Some(next) = page_token.clone() {
            query.push(("pageToken", next));
        }
        let page = account_page(
            get_json(
                client,
                token,
                endpoint,
                &query,
                "Google Analytics Admin API",
            )
            .await?,
        )?;
        for account in page.account_summaries {
            add_candidates(&mut candidates, &mut seen, account)?;
        }
        let next = next_page_token(page.next_page_token)?;
        if page_token
            .as_ref()
            .is_some_and(|current| next.as_ref() == Some(current))
        {
            return Ok((candidates, pages, true));
        }
        page_token = next;
        if page_token.is_none() {
            break;
        }
        if index + 1 == MAX_PAGES {
            truncated = true;
        }
    }
    Ok((candidates, pages, truncated))
}

fn add_candidates(
    candidates: &mut Vec<PropertyCandidate>,
    seen: &mut HashSet<String>,
    account: AccountSummary,
) -> Result<(), String> {
    for property in account.property_summaries {
        let name = property_name(&property.property)?;
        if seen.insert(name.clone()) {
            candidates.push(PropertyCandidate {
                property: name,
                display_name: property
                    .display_name
                    .filter(|value| !value.trim().is_empty()),
            });
        }
    }
    Ok(())
}
