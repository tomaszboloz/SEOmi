use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{Days, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    time::{timeout, Duration},
};
use url::Url;
use uuid::Uuid;

use crate::commands::settings::secret_entry;

const OAUTH_SCOPE: &str = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const SITES_URL: &str = "https://searchconsole.googleapis.com/webmasters/v3/sites";
const TOKEN_TIMEOUT: Duration = Duration::from_secs(180);
const SEARCH_ROW_PAGE_SIZE: usize = 10_000;
const SEARCH_ROW_MAX: usize = 25_000;

struct AnalyticsRows {
    rows: Vec<Value>,
    may_be_truncated: bool,
}

#[derive(Deserialize, Clone, Default, serde::Serialize, PartialEq, Eq)]
pub struct GscPerformanceFilters {
    #[serde(alias = "searchType", skip_serializing_if = "Option::is_none")]
    pub search_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
}

const GSC_SEARCH_TYPES: [&str; 6] = ["web", "image", "video", "news", "discover", "googleNews"];
const GSC_DEVICES: [&str; 3] = ["DESKTOP", "MOBILE", "TABLET"];

fn normalize_filters(
    filters: Option<GscPerformanceFilters>,
) -> Result<GscPerformanceFilters, String> {
    let mut filters = filters.unwrap_or_default();
    if let Some(search_type) = filters.search_type.as_mut() {
        *search_type = search_type.trim().to_string();
        if !GSC_SEARCH_TYPES.contains(&search_type.as_str()) {
            return Err("Nieprawidłowy typ wyszukiwania Search Console.".into());
        }
    }
    if let Some(device) = filters.device.as_mut() {
        *device = device.trim().to_ascii_uppercase();
        if !GSC_DEVICES.contains(&device.as_str()) {
            return Err("Urządzenie Search Console musi być DESKTOP, MOBILE albo TABLET.".into());
        }
    }
    if let Some(country) = filters.country.as_mut() {
        *country = country.trim().to_ascii_lowercase();
        if country.len() != 3 || !country.bytes().all(|byte| byte.is_ascii_alphabetic()) {
            return Err(
                "Kraj Search Console musi być kodem ISO 3166-1 alpha-3, np. usa lub gbr.".into(),
            );
        }
    }
    Ok(filters)
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SitesResponse {
    site_entry: Option<Vec<GscSiteProperty>>,
}

#[derive(Deserialize, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GscSiteProperty {
    pub site_url: String,
    pub permission_level: String,
}

fn validate_client_id(client_id: &str) -> Result<String, String> {
    let value = client_id.trim();
    if value.len() > 255
        || !value.ends_with(".apps.googleusercontent.com")
        || value.contains(char::is_whitespace)
    {
        return Err(
            "Wprowadź prawidłowy OAuth Client ID typu Desktop app z Google Cloud Console.".into(),
        );
    }
    Ok(value.to_string())
}

fn refresh_token_key(project_id: &str) -> Result<String, String> {
    if !project_id
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '-')
        || !(1..=80).contains(&project_id.len())
    {
        return Err("Nieprawidłowy identyfikator projektu Google Search Console.".into());
    }
    Ok(format!("gsc_refresh_token_{project_id}"))
}

fn client_secret_key(project_id: &str) -> Result<String, String> {
    if !project_id
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '-')
        || !(1..=80).contains(&project_id.len())
    {
        return Err("Invalid Search Console project identifier.".into());
    }
    Ok(format!("gsc_client_secret_{project_id}"))
}

fn code_challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

fn send_browser_to(url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("rundll32.exe")
        .arg("url.dll,FileProtocolHandler")
        .arg(url)
        .spawn();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let result: Result<std::process::Child, std::io::Error> = Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "Unsupported platform",
    ));
    result
        .map(|_| ())
        .map_err(|error| format!("Unable to open the system browser: {error}"))
}

async fn receive_oauth_code(listener: TcpListener, expected_state: &str) -> Result<String, String> {
    timeout(TOKEN_TIMEOUT, async move {
        loop {
            let (mut stream, _) = listener
                .accept()
                .await
                .map_err(|error| format!("Unable to receive the OAuth response: {error}"))?;
            let mut buffer = vec![0u8; 16 * 1024];
            let read = stream
                .read(&mut buffer)
                .await
                .map_err(|error| format!("Unable to read the OAuth response: {error}"))?;
            let request = String::from_utf8_lossy(&buffer[..read]);
            let path = request
                .lines()
                .next()
                .and_then(|line| line.split_whitespace().nth(1))
                .unwrap_or("/");
            let callback = Url::parse(&format!("http://127.0.0.1{path}"))
                .map_err(|_| "Google zwrócił nieprawidłowy adres OAuth.".to_string())?;
            if callback.path() != "/oauth2callback" {
                let _ = write_callback_response(
                    &mut stream,
                    "404 Not Found",
                    "Nieznany lokalny callback OAuth.",
                )
                .await;
                continue;
            }
            let query: std::collections::HashMap<String, String> =
                callback.query_pairs().into_owned().collect();
            if query.get("state").map(String::as_str) != Some(expected_state) {
                let _ = write_callback_response(
                    &mut stream,
                    "400 Bad Request",
                    "Weryfikacja stanu OAuth nie powiodła się. Możesz zamknąć tę kartę.",
                )
                .await;
                continue;
            }
            if let Some(error) = query.get("error") {
                let _ = write_callback_response(
                    &mut stream,
                    "400 Bad Request",
                    "Autoryzacja Google została anulowana. Możesz zamknąć tę kartę.",
                )
                .await;
                return Err(if error == "access_denied" {
                    "Autoryzacja Search Console została anulowana przez użytkownika.".into()
                } else {
                    format!("Google OAuth failed: {error}")
                });
            }
            let code = query
                .get("code")
                .filter(|value| !value.is_empty())
                .cloned()
                .ok_or_else(|| "Google did not return an authorization code.".to_string())?;
            write_callback_response(
                &mut stream,
                "200 OK",
                "SEOmi otrzymało odpowiedź Google. Możesz wrócić do aplikacji i zamknąć tę kartę.",
            )
            .await?;
            return Ok(code);
        }
    })
    .await
    .map_err(|_| "Logowanie Google nie zostało zakończone w ciągu 3 minut.".to_string())?
}

async fn write_callback_response(
    stream: &mut tokio::net::TcpStream,
    status: &str,
    message: &str,
) -> Result<(), String> {
    let body =
        format!("<!doctype html><meta charset=\"utf-8\"><title>SEOmi</title><p>{message}</p>");
    let response = format!("HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n{body}", body.len());
    stream
        .write_all(response.as_bytes())
        .await
        .map_err(|error| format!("Unable to complete the OAuth callback: {error}"))
}

async fn exchange_code(
    client: &reqwest::Client,
    client_id: &str,
    code: &str,
    verifier: &str,
    redirect_uri: &str,
    client_secret: Option<&str>,
) -> Result<TokenResponse, String> {
    let mut form = vec![
        ("client_id", client_id.to_string()),
        ("code", code.to_string()),
        ("code_verifier", verifier.to_string()),
        ("grant_type", "authorization_code".to_string()),
        ("redirect_uri", redirect_uri.to_string()),
    ];
    if let Some(secret) = client_secret.filter(|value| !value.trim().is_empty()) {
        form.push(("client_secret", secret.to_string()));
    }
    let response = client
        .post(TOKEN_URL)
        .form(&form)
        .send()
        .await
        .map_err(|error| format!("Unable to exchange the Google OAuth code: {error}"))?;
    let status = response.status();
    let token = response
        .json::<TokenResponse>()
        .await
        .map_err(|error| format!("Google zwrócił nieprawidłową odpowiedź OAuth: {error}"))?;
    if !status.is_success() || token.access_token.is_none() {
        return Err(token.error_description.or(token.error).unwrap_or_else(|| {
            format!("Wymiana tokenu Google zakończyła się statusem {status}.")
        }));
    }
    Ok(token)
}

async fn refresh_access_token(
    client: &reqwest::Client,
    project_id: &str,
    client_id: &str,
) -> Result<String, String> {
    let key = refresh_token_key(project_id)?;
    let refresh_token = secret_entry(&key)?.get_password().map_err(|_| {
        "Brak tokenu Search Console w magazynie poświadczeń systemowych. Połącz konto ponownie."
            .to_string()
    })?;
    let client_secret = client_secret_key(project_id)
        .ok()
        .and_then(|key| secret_entry(&key).ok())
        .and_then(|entry| entry.get_password().ok());
    let mut form = vec![
        ("client_id", client_id.to_string()),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token".to_string()),
    ];
    if let Some(secret) = client_secret.filter(|value| !value.trim().is_empty()) {
        form.push(("client_secret", secret));
    }
    let response = client
        .post(TOKEN_URL)
        .form(&form)
        .send()
        .await
        .map_err(|error| format!("Unable to refresh the Google token: {error}"))?;
    let status = response.status();
    let token = response.json::<TokenResponse>().await.map_err(|error| {
        format!("Google zwrócił nieprawidłową odpowiedź odświeżenia tokenu: {error}")
    })?;
    if !status.is_success() || token.access_token.is_none() {
        return Err(token.error_description.or(token.error).unwrap_or_else(|| {
            format!("Odświeżenie tokenu Google zakończyło się statusem {status}.")
        }));
    }
    Ok(token.access_token.unwrap())
}

async fn token_json(access_token: &str, request: reqwest::RequestBuilder) -> Result<Value, String> {
    let response = request
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|error| format!("Żądanie Google Search Console nie powiodło się: {error}"))?;
    let status = response.status();
    let body = response.json::<Value>().await.map_err(|error| {
        format!("Google Search Console zwróciło nieprawidłową odpowiedź: {error}")
    })?;
    if !status.is_success() {
        let message = body
            .pointer("error.message")
            .and_then(Value::as_str)
            .unwrap_or("nieznany błąd API");
        return Err(format!("Google Search Console HTTP {status}: {message}"));
    }
    Ok(body)
}

async fn authorized_json(
    client: &reqwest::Client,
    project_id: &str,
    client_id: &str,
    request: reqwest::RequestBuilder,
) -> Result<Value, String> {
    let access_token = refresh_access_token(client, project_id, client_id).await?;
    token_json(&access_token, request).await
}

async fn site_properties(
    client: &reqwest::Client,
    access_token: &str,
) -> Result<Vec<GscSiteProperty>, String> {
    let response = client
        .get(SITES_URL)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|error| format!("Unable to retrieve Search Console properties: {error}"))?;
    let status = response.status();
    let body = response
        .json::<SitesResponse>()
        .await
        .map_err(|error| format!("Google zwrócił nieprawidłową listę properties: {error}"))?;
    if !status.is_success() {
        return Err(format!(
            "Pobranie properties Search Console zakończyło się statusem {status}."
        ));
    }
    Ok(body.site_entry.unwrap_or_default())
}

#[tauri::command]
pub async fn connect_search_console(
    project_id: String,
    client_id: String,
    client_secret: Option<String>,
) -> Result<Vec<GscSiteProperty>, String> {
    let client_id = validate_client_id(&client_id)?;
    let refresh_key = refresh_token_key(&project_id)?;
    let old_refresh_token = secret_entry(&refresh_key)
        .ok()
        .and_then(|entry| entry.get_password().ok());
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|error| format!("Unable to start the local OAuth callback: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("Unable to determine the OAuth port: {error}"))?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}/oauth2callback");
    let state = Uuid::new_v4().simple().to_string();
    let verifier = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let challenge = code_challenge(&verifier);
    let mut auth_url = Url::parse("https://accounts.google.com/o/oauth2/v2/auth")
        .map_err(|error| error.to_string())?;
    auth_url
        .query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", OAUTH_SCOPE)
        .append_pair("state", &state)
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent");
    send_browser_to(auth_url.as_str())?;
    let code = receive_oauth_code(listener, &state).await?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| format!("Unable to create the Google OAuth client: {error}"))?;
    let client_secret = client_secret
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            client_secret_key(&project_id)
                .ok()
                .and_then(|key| secret_entry(&key).ok())
                .and_then(|entry| entry.get_password().ok())
        });
    let token = exchange_code(
        &client,
        &client_id,
        &code,
        &verifier,
        &redirect_uri,
        client_secret.as_deref(),
    )
    .await?;
    let access_token = token
        .access_token
        .ok_or_else(|| "Google OAuth did not return an access token.".to_string())?;
    let refresh_token = token.refresh_token.or(old_refresh_token)
        .ok_or_else(|| "Google did not return a refresh token. Revoke SEOmi access in your Google account and connect again.".to_string())?;
    let properties = site_properties(&client, &access_token).await?;
    secret_entry(&refresh_key)?
        .set_password(&refresh_token)
        .map_err(|error| {
            format!(
                "Unable to save the Search Console token in the system credential store: {error}"
            )
        })?;
    if let Some(secret) = client_secret.filter(|value| !value.trim().is_empty()) {
        secret_entry(&client_secret_key(&project_id)?)?
            .set_password(&secret)
            .map_err(|error| format!("Unable to save the Search Console client secret: {error}"))?;
    }
    Ok(properties)
}

#[tauri::command]
pub async fn list_search_console_properties(
    project_id: String,
    client_id: String,
) -> Result<Vec<GscSiteProperty>, String> {
    let client_id = validate_client_id(&client_id)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| error.to_string())?;
    let access_token = refresh_access_token(&client, &project_id, &client_id).await?;
    site_properties(&client, &access_token).await
}

fn date_range() -> (String, String) {
    let end = Utc::now()
        .date_naive()
        .checked_sub_days(Days::new(3))
        .unwrap_or_else(|| Utc::now().date_naive());
    let start = end.checked_sub_days(Days::new(27)).unwrap_or(end);
    (start.to_string(), end.to_string())
}

fn requested_date_range(
    start_date: Option<&str>,
    end_date: Option<&str>,
) -> Result<(String, String), String> {
    match (start_date, end_date) {
        (None, None) => Ok(date_range()),
        (Some(start), Some(end)) => {
            let start = NaiveDate::parse_from_str(start, "%Y-%m-%d").map_err(|_| {
                "Data początkowa musi mieć prawidłowy format RRRR-MM-DD.".to_string()
            })?;
            let end = NaiveDate::parse_from_str(end, "%Y-%m-%d")
                .map_err(|_| "Data końcowa musi mieć prawidłowy format RRRR-MM-DD.".to_string())?;
            if start > end {
                return Err("Data początkowa musi być wcześniejsza lub równa końcowej.".into());
            }
            let latest = Utc::now()
                .date_naive()
                .checked_sub_days(Days::new(3))
                .unwrap_or_else(|| Utc::now().date_naive());
            if end > latest {
                return Err(format!("Search Console zwykle udostępnia kompletne dane do {latest}; wybierz wcześniejszy zakres."));
            }
            Ok((start.to_string(), end.to_string()))
        }
        _ => Err("Podaj obie daty zakresu Search Console.".into()),
    }
}

fn site_path(site_url: &str) -> String {
    url::form_urlencoded::byte_serialize(site_url.as_bytes()).collect()
}

fn next_start_row(start_row: usize, returned_rows: usize, requested_rows: usize) -> Option<usize> {
    let next = start_row.saturating_add(returned_rows);
    (returned_rows == requested_rows && next < SEARCH_ROW_MAX).then_some(next)
}

fn analytics_page_request(
    start: &str,
    end: &str,
    dimension: Option<&str>,
    start_row: usize,
    filters: &GscPerformanceFilters,
) -> (Value, usize) {
    let requested_rows = SEARCH_ROW_PAGE_SIZE.min(SEARCH_ROW_MAX.saturating_sub(start_row));
    let mut payload = json!({"startDate": start, "endDate": end, "rowLimit": requested_rows, "startRow": start_row});
    if let Some(dimension) = dimension {
        payload["dimensions"] = json!([dimension]);
    }
    if let Some(search_type) = filters.search_type.as_deref() {
        payload["type"] = json!(search_type);
    }
    let mut dimension_filters = Vec::new();
    if let Some(device) = filters.device.as_deref() {
        dimension_filters
            .push(json!({"dimension": "device", "operator": "equals", "expression": device}));
    }
    if let Some(country) = filters.country.as_deref() {
        dimension_filters
            .push(json!({"dimension": "country", "operator": "equals", "expression": country}));
    }
    if !dimension_filters.is_empty() {
        payload["dimensionFilterGroups"] =
            json!([{"groupType": "and", "filters": dimension_filters}]);
    }
    (payload, requested_rows)
}

async fn performance_rows(
    client: &reqwest::Client,
    access_token: &str,
    site_url: &str,
    start: &str,
    end: &str,
    dimension: Option<&str>,
    filters: &GscPerformanceFilters,
) -> Result<AnalyticsRows, String> {
    let endpoint = format!(
        "https://searchconsole.googleapis.com/webmasters/v3/sites/{}/searchAnalytics/query",
        site_path(site_url)
    );
    let mut rows = Vec::new();
    let mut start_row = 0usize;
    loop {
        let (payload, requested_rows) =
            analytics_page_request(start, end, dimension, start_row, filters);
        let body = token_json(access_token, client.post(&endpoint).json(&payload)).await?;
        let page = body
            .get("rows")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let returned_rows = page.len();
        rows.extend(page);
        if dimension.is_none() {
            return Ok(AnalyticsRows {
                rows,
                may_be_truncated: false,
            });
        }
        let Some(next) = next_start_row(start_row, returned_rows, requested_rows) else {
            return Ok(AnalyticsRows {
                may_be_truncated: start_row + returned_rows >= SEARCH_ROW_MAX
                    && returned_rows == requested_rows,
                rows,
            });
        };
        start_row = next;
    }
}

fn metric(row: &Value, index: usize) -> f64 {
    row.get(["clicks", "impressions", "ctr", "position"][index])
        .and_then(Value::as_f64)
        .unwrap_or(0.0)
}

fn map_analytics_row(row: &Value, key_name: &str) -> Value {
    let mut result = json!({
        "clicks": metric(row, 0), "impressions": metric(row, 1),
        "ctr": (metric(row, 2) * 100.0 * 10.0).round() / 10.0,
        "position": (metric(row, 3) * 10.0).round() / 10.0,
    });
    result[key_name] = row
        .get("keys")
        .and_then(Value::as_array)
        .and_then(|keys| keys.first())
        .cloned()
        .unwrap_or(Value::String(String::new()));
    result
}

#[allow(clippy::too_many_arguments)]
fn map_performance(
    site_url: &str,
    start: &str,
    end: &str,
    queries: &[Value],
    pages: &[Value],
    totals: &[Value],
    daily: &[Value],
    filters: &GscPerformanceFilters,
    queries_may_be_truncated: bool,
    pages_may_be_truncated: bool,
) -> Value {
    let total = totals.first().cloned().unwrap_or_else(|| json!({}));
    let mut daily_rows = daily
        .iter()
        .map(|row| map_analytics_row(row, "date"))
        .collect::<Vec<_>>();
    daily_rows.sort_by(|left, right| left["date"].as_str().cmp(&right["date"].as_str()));
    json!({
        "site_url": site_url,
        "start_date": start,
        "end_date": end,
        "filters": filters,
        "total_clicks": metric(&total, 0),
        "total_impressions": metric(&total, 1),
        "avg_ctr": (metric(&total, 2) * 100.0 * 10.0).round() / 10.0,
        "avg_position": (metric(&total, 3) * 10.0).round() / 10.0,
        "queries": queries.iter().map(|row| map_analytics_row(row, "query")).collect::<Vec<_>>(),
        "pages": pages.iter().map(|row| map_analytics_row(row, "page")).collect::<Vec<_>>(),
        "daily": daily_rows,
        "queries_may_be_truncated": queries_may_be_truncated,
        "pages_may_be_truncated": pages_may_be_truncated,
        "daily_may_be_truncated": daily.len() >= SEARCH_ROW_MAX,
        "max_rows_per_dimension": SEARCH_ROW_MAX,
    })
}

#[tauri::command]
pub async fn search_console_performance(
    project_id: String,
    client_id: String,
    site_url: String,
    start_date: Option<String>,
    end_date: Option<String>,
    filters: Option<GscPerformanceFilters>,
) -> Result<Value, String> {
    let client_id = validate_client_id(&client_id)?;
    if site_url.trim().is_empty() {
        return Err("Wybierz property Search Console.".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let (start, end) = requested_date_range(start_date.as_deref(), end_date.as_deref())?;
    let filters = normalize_filters(filters)?;
    let access_token = refresh_access_token(&client, &project_id, &client_id).await?;
    let (queries, pages, totals, daily) = tokio::try_join!(
        performance_rows(
            &client,
            &access_token,
            &site_url,
            &start,
            &end,
            Some("query"),
            &filters,
        ),
        performance_rows(
            &client,
            &access_token,
            &site_url,
            &start,
            &end,
            Some("page"),
            &filters,
        ),
        performance_rows(
            &client,
            &access_token,
            &site_url,
            &start,
            &end,
            None,
            &filters
        ),
        performance_rows(
            &client,
            &access_token,
            &site_url,
            &start,
            &end,
            Some("date"),
            &filters,
        ),
    )?;
    Ok(map_performance(
        &site_url,
        &start,
        &end,
        &queries.rows,
        &pages.rows,
        &totals.rows,
        &daily.rows,
        &filters,
        queries.may_be_truncated,
        pages.may_be_truncated,
    ))
}

#[tauri::command]
pub async fn inspect_search_console_url(
    project_id: String,
    client_id: String,
    site_url: String,
    inspection_url: String,
) -> Result<Value, String> {
    let client_id = validate_client_id(&client_id)?;
    let parsed = Url::parse(&inspection_url)
        .map_err(|_| "Wprowadź pełny URL HTTP lub HTTPS do inspekcji.".to_string())?;
    if !["http", "https"].contains(&parsed.scheme()) || parsed.host_str().is_none() {
        return Err("Wprowadź pełny URL HTTP lub HTTPS do inspekcji.".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let endpoint = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
    authorized_json(
        &client,
        &project_id,
        &client_id,
        client.post(endpoint).json(&json!({
            "inspectionUrl": parsed.as_str(), "siteUrl": site_url, "languageCode": "pl-PL"
        })),
    )
    .await
}

#[tauri::command]
pub async fn disconnect_search_console(project_id: String) -> Result<String, String> {
    let key = refresh_token_key(&project_id)?;
    let client_secret_key = client_secret_key(&project_id)?;
    match secret_entry(&client_secret_key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => (),
        Err(error) => {
            return Err(format!(
                "Unable to remove the Search Console client secret: {error}"
            ))
        }
    }
    let entry = secret_entry(&key)?;
    let refresh_token = match entry.get_password() {
        Ok(token) => Some(token),
        Err(keyring::Error::NoEntry) => None,
        Err(error) => return Err(format!("Unable to read the Search Console token: {error}")),
    };
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => (),
        Err(error) => {
            return Err(format!(
                "Unable to remove the Search Console token from the credential store: {error}"
            ))
        }
    }
    let Some(refresh_token) = refresh_token else {
        return Ok("Lokalny token Search Console został już usunięty.".into());
    };
    let client = reqwest::Client::builder().timeout(Duration::from_secs(10)).build().map_err(|error| format!("The token was removed locally, but unable to create the Google consent revocation client: {error}"))?;
    match client.post("https://oauth2.googleapis.com/revoke").form(&[("token", refresh_token)]).send().await {
        Ok(response) if response.status().is_success() => Ok("Token Search Console usunięto z aplikacji i cofnięto zgodę Google.".into()),
        Ok(response) => Ok(format!("Token usunięto z aplikacji, ale Google nie potwierdziło cofnięcia zgody (HTTP {}). Cofnij dostęp SEOmi również w ustawieniach konta Google.", response.status())),
        Err(error) => Ok(format!("The token was removed from the app, but Google consent revocation could not be confirmed ({error}). Revoke SEOmi access in your Google account settings as well.")),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        analytics_page_request, code_challenge, date_range, map_performance, next_start_row,
        normalize_filters, refresh_token_key, requested_date_range, site_path, validate_client_id,
        GscPerformanceFilters, SEARCH_ROW_PAGE_SIZE,
    };
    use serde_json::json;

    #[test]
    fn accepts_desktop_oauth_client_ids_and_rejects_arbitrary_values() {
        assert!(validate_client_id("123.apps.googleusercontent.com").is_ok());
        assert!(validate_client_id("not a client id").is_err());
    }

    #[test]
    fn project_tokens_are_separated_by_valid_project_ids() {
        assert_eq!(
            refresh_token_key("project-123").unwrap(),
            "gsc_refresh_token_project-123"
        );
        assert!(refresh_token_key("../outside").is_err());
    }

    #[test]
    fn property_urls_are_encoded_as_one_path_segment() {
        assert_eq!(
            site_path("https://example.com/"),
            "https%3A%2F%2Fexample.com%2F"
        );
    }

    #[test]
    fn query_date_window_is_28_complete_days_ending_three_days_ago() {
        let (start, end) = date_range();
        let start = chrono::NaiveDate::parse_from_str(&start, "%Y-%m-%d").unwrap();
        let end = chrono::NaiveDate::parse_from_str(&end, "%Y-%m-%d").unwrap();
        assert_eq!((end - start).num_days(), 27);
        assert_eq!((chrono::Utc::now().date_naive() - end).num_days(), 3);
    }

    #[test]
    fn accepts_valid_requested_window_and_rejects_partial_or_invalid_dates() {
        assert_eq!(
            requested_date_range(Some("2026-01-01"), Some("2026-01-31")).unwrap(),
            ("2026-01-01".into(), "2026-01-31".into())
        );
        assert!(requested_date_range(Some("2026-02-30"), Some("2026-03-01")).is_err());
        assert!(requested_date_range(Some("2026-02-02"), Some("2026-02-01")).is_err());
        assert!(requested_date_range(Some("2026-01-01"), None).is_err());
        assert!(requested_date_range(Some("2999-01-01"), Some("2999-01-02")).is_err());
    }

    #[test]
    fn creates_rfc7636_s256_challenge_from_the_verifier() {
        assert_eq!(
            code_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn maps_search_analytics_contract_without_inventing_rows() {
        let output = map_performance(
            "sc-domain:example.com",
            "2026-09-01",
            "2026-09-28",
            &[
                json!({"keys":["seo tools"],"clicks":12,"impressions":200,"ctr":0.06,"position":4.25}),
            ],
            &[
                json!({"keys":["https://example.com/"],"clicks":8,"impressions":160,"ctr":0.05,"position":3.5}),
            ],
            &[json!({"clicks":12,"impressions":200,"ctr":0.06,"position":4.25})],
            &[
                json!({"keys":["2026-09-02"],"clicks":2,"impressions":25,"ctr":0.08,"position":4.75}),
                json!({"keys":["2026-09-01"],"clicks":3,"impressions":50,"ctr":0.06,"position":4.25}),
            ],
            &GscPerformanceFilters::default(),
            false,
            false,
        );
        assert_eq!(output["avg_ctr"], 6.0);
        assert_eq!(output["avg_position"], 4.3);
        assert_eq!(output["queries"][0]["query"], "seo tools");
        assert_eq!(output["queries"][0]["ctr"], 6.0);
        assert_eq!(output["pages"][0]["page"], "https://example.com/");
        assert_eq!(output["pages"][0]["clicks"], 8.0);
        assert_eq!(output["queries_may_be_truncated"], false);
        assert_eq!(output["filters"], json!({}));
        assert_eq!(output["daily"][0]["date"], "2026-09-01");
        assert_eq!(output["daily"][0]["clicks"], 3.0);
        assert_eq!(output["daily"][1]["date"], "2026-09-02");
    }

    #[test]
    fn analytics_pagination_uses_start_row_and_stops_at_google_response_cap() {
        assert_eq!(SEARCH_ROW_PAGE_SIZE, 10_000);
        assert_eq!(
            next_start_row(0, SEARCH_ROW_PAGE_SIZE, SEARCH_ROW_PAGE_SIZE),
            Some(10_000)
        );
        assert_eq!(
            next_start_row(10_000, SEARCH_ROW_PAGE_SIZE, SEARCH_ROW_PAGE_SIZE),
            Some(20_000)
        );
        assert_eq!(next_start_row(20_000, 5_000, 5_000), None);
        assert_eq!(next_start_row(0, 12, SEARCH_ROW_PAGE_SIZE), None);
        let filters = GscPerformanceFilters {
            search_type: Some("web".into()),
            device: Some("MOBILE".into()),
            country: Some("pol".into()),
        };
        let (request, requested) =
            analytics_page_request("2026-08-01", "2026-08-28", Some("query"), 20_000, &filters);
        assert_eq!(requested, 5_000);
        assert_eq!(request["rowLimit"], 5_000);
        assert_eq!(request["startRow"], 20_000);
        assert_eq!(request["dimensions"][0], "query");
        assert_eq!(request["type"], "web");
        assert_eq!(
            request["dimensionFilterGroups"][0]["filters"][0]["expression"],
            "MOBILE"
        );
        assert_eq!(
            request["dimensionFilterGroups"][0]["filters"][1]["expression"],
            "pol"
        );
    }

    #[test]
    fn validates_and_normalizes_real_search_console_filter_values() {
        let filters = normalize_filters(Some(GscPerformanceFilters {
            search_type: Some(" web ".into()),
            device: Some("mobile".into()),
            country: Some(" POL ".into()),
        }))
        .unwrap();
        assert_eq!(filters.search_type.as_deref(), Some("web"));
        assert_eq!(filters.device.as_deref(), Some("MOBILE"));
        assert_eq!(filters.country.as_deref(), Some("pol"));
        assert!(normalize_filters(Some(GscPerformanceFilters {
            country: Some("pl".into()),
            ..Default::default()
        }))
        .is_err());
        assert!(normalize_filters(Some(GscPerformanceFilters {
            device: Some("PHONE".into()),
            ..Default::default()
        }))
        .is_err());
    }
}
