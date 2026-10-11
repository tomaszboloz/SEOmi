use super::{
    models::{AccountPage, Ga4Row, Ga4StreamEvidence, ReportPage, StreamPage, WebDataStream},
    validation::{host_matches, metric, normalize_host, property_name, stream_host, SiteScope},
};
use serde_json::Value;

pub(super) fn account_page(value: Value) -> Result<AccountPage, String> {
    let page: AccountPage = serde_json::from_value(value)
        .map_err(|_| "Google Analytics returned an invalid account summary.".to_string())?;
    for account in &page.account_summaries {
        for property in &account.property_summaries {
            property_name(&property.property)?;
        }
    }
    Ok(page)
}

pub(super) fn stream_page(value: Value) -> Result<StreamPage, String> {
    serde_json::from_value(value)
        .map_err(|_| "Google Analytics returned an invalid data stream list.".to_string())
}

pub(super) fn matching_streams(
    page: &StreamPage,
    scope: &SiteScope,
) -> Result<Vec<Ga4StreamEvidence>, String> {
    let mut matches = Vec::new();
    for stream in &page.data_streams {
        if let Some(result) = matching_stream(stream, scope) {
            matches.push(result?);
        }
    }
    Ok(matches)
}

fn matching_stream(
    stream: &WebDataStream,
    scope: &SiteScope,
) -> Option<Result<Ga4StreamEvidence, String>> {
    if stream
        .stream_type
        .as_deref()
        .is_some_and(|stream_type| stream_type != "WEB_DATA_STREAM")
    {
        return None;
    }
    let web_data = stream.web_stream_data.as_ref()?;
    let uri = web_data.default_uri.as_deref()?;
    let host = match stream_host(uri) {
        Ok(host) => host,
        Err(error) => return Some(Err(error)),
    };
    if !host_matches(scope, &host) {
        return None;
    }
    let name = stream
        .name
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("web stream")
        .to_string();
    Some(Ok(Ga4StreamEvidence {
        name,
        display_name: stream.display_name.clone(),
        default_uri: uri.to_string(),
        host_name: host,
        measurement_id: web_data.measurement_id.clone(),
    }))
}

pub(super) fn report_page(value: Value) -> Result<ReportPage, String> {
    serde_json::from_value(value)
        .map_err(|_| "Google Analytics returned an invalid report.".to_string())
}

pub(super) fn report_rows(
    page: &ReportPage,
    scope: &SiteScope,
    expected_host: &str,
) -> Result<Vec<Ga4Row>, String> {
    validate_headers(page)?;
    page.rows
        .iter()
        .map(|row| {
            if row.dimension_values.len() != 2 || row.metric_values.len() != 3 {
                return Err("Google Analytics returned an invalid report row.".into());
            }
            let landing = row.dimension_values[0]
                .value
                .clone()
                .ok_or_else(|| "Google Analytics returned an invalid report row.".to_string())?;
            let host = row.dimension_values[1]
                .value
                .as_deref()
                .and_then(|value| normalize_host(value).ok())
                .filter(|value| host_matches(scope, value) && value == expected_host)
                .ok_or_else(|| {
                    "Google Analytics returned traffic for an unrelated host.".to_string()
                })?;
            Ok(Ga4Row {
                landing_page: landing,
                host_name: host,
                sessions: metric(row.metric_values[0].value.as_deref())?,
                engaged_sessions: metric(row.metric_values[1].value.as_deref())?,
                key_events: metric(row.metric_values[2].value.as_deref())?,
            })
        })
        .collect()
}

fn validate_headers(page: &ReportPage) -> Result<(), String> {
    let dimensions = page
        .dimension_headers
        .iter()
        .filter_map(|header| header.name.as_deref())
        .collect::<Vec<_>>();
    let metrics = page
        .metric_headers
        .iter()
        .filter_map(|header| header.name.as_deref())
        .collect::<Vec<_>>();
    if (!dimensions.is_empty()
        && dimensions.as_slice() != ["landingPagePlusQueryString", "hostName"].as_slice())
        || (!metrics.is_empty()
            && metrics.as_slice() != ["sessions", "engagedSessions", "keyEvents"].as_slice())
    {
        return Err("Google Analytics returned an invalid report schema.".into());
    }
    Ok(())
}
