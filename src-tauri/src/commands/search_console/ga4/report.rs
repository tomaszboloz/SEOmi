use super::{
    mapping::{report_page, report_rows},
    models::{Ga4Report, Ga4Status},
    transport::{api_endpoint, post_json},
    validation::{
        access_token, date_range, host_matches, property_name, site_scope, REPORT_PAGE_SIZE,
        REPORT_ROW_MAX,
    },
};
use reqwest::Client;
use serde_json::json;

pub(super) const DATA_API_BASE: &str = "https://analyticsdata.googleapis.com";

#[allow(clippy::too_many_arguments)]
pub(super) async fn run_at(
    client: &Client,
    token: &str,
    property: &str,
    site_url: &str,
    host_name: &str,
    start: &str,
    end: &str,
    data_base: &str,
) -> Result<Ga4Report, String> {
    let token = access_token(token)?;
    let property = property_name(property)?;
    let scope = site_scope(site_url)?;
    let (start, end) = date_range(start, end)?;
    if !host_matches(&scope, host_name) {
        return Err("Google Analytics web stream is outside the selected site.".into());
    }
    let host_name = super::validation::normalize_host(host_name)?;
    let endpoint = api_endpoint(data_base, &format!("{property}:runReport"));
    let mut rows = Vec::new();
    let mut row_count = None;
    let mut offset = 0usize;
    let mut pages = 0;
    let mut truncated = false;
    for _ in 0..super::validation::MAX_PAGES {
        if offset >= REPORT_ROW_MAX {
            truncated = row_count.is_none_or(|count| count > REPORT_ROW_MAX);
            break;
        }
        pages += 1;
        let limit = REPORT_PAGE_SIZE.min(REPORT_ROW_MAX - offset);
        let payload = report_request(&start, &end, &host_name, offset, limit);
        let page = report_page(
            post_json(
                client,
                token,
                &endpoint,
                &payload,
                "Google Analytics Data API",
            )
            .await?,
        )?;
        if let Some(page_count) = page.row_count {
            if let Some(previous_count) = row_count {
                if previous_count != page_count {
                    return Err(
                        "Google Analytics returned an inconsistent report row count.".into(),
                    );
                }
            } else {
                row_count = Some(page_count);
            }
        }
        let page_rows = report_rows(&page, &scope, &host_name)?;
        let returned = page_rows.len();
        rows.extend(page_rows);
        offset = offset.saturating_add(returned);
        if returned == 0 {
            break;
        }
        if row_count.is_some_and(|count| offset >= count) {
            break;
        }
        if returned < limit && row_count.is_none() {
            break;
        }
        if returned < limit && page.row_count.is_none() {
            break;
        }
        if pages == super::validation::MAX_PAGES {
            truncated = true;
        }
    }
    if row_count.is_some_and(|count| count > rows.len()) {
        truncated = true;
    }
    if row_count.is_some_and(|count| count < rows.len()) {
        return Err("Google Analytics returned an invalid report row count.".into());
    }
    if rows.is_empty() && row_count.is_some_and(|count| count > 0) {
        truncated = true;
    }
    let status = if rows.is_empty() {
        Ga4Status::Missing
    } else if truncated {
        Ga4Status::Partial
    } else {
        Ga4Status::Complete
    };
    Ok(Ga4Report {
        status,
        property,
        host_name,
        start_date: start,
        end_date: end,
        rows,
        row_count,
        pages,
        may_be_truncated: truncated,
    })
}

fn report_request(
    start: &str,
    end: &str,
    host_name: &str,
    offset: usize,
    limit: usize,
) -> serde_json::Value {
    json!({
        "dateRanges": [{"startDate": start, "endDate": end}],
        "dimensions": [
            {"name": "landingPagePlusQueryString"},
            {"name": "hostName"}
        ],
        "metrics": [
            {"name": "sessions"},
            {"name": "engagedSessions"},
            {"name": "keyEvents"}
        ],
        "dimensionFilter": {
            "filter": {
                "fieldName": "hostName",
                "stringFilter": {
                    "matchType": "EXACT",
                    "value": host_name,
                    "caseSensitive": false
                }
            }
        },
        "offset": offset,
        "limit": limit
    })
}
