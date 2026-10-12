use super::super::{connect, credentials, dates, session, tokens};
use super::{collect, discover, validation};
use session::NativeCredentialStore;
use std::time::Duration;

pub(super) const GA4_OAUTH_SCOPE: &str =
    "https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly";

#[tauri::command]
pub async fn connect_google_analytics(
    project_id: String,
    client_id: String,
    client_secret: Option<String>,
) -> Result<Vec<super::super::models::GscSiteProperty>, String> {
    credentials::validate_client_id(&client_id)?;
    credentials::refresh_token_key(&project_id)?;
    let store = NativeCredentialStore;
    let dependencies = session::ConnectDependencies::production(&store);
    connect::connect_with_scope(
        project_id,
        client_id,
        client_secret,
        dependencies,
        GA4_OAUTH_SCOPE,
    )
    .await
}

#[tauri::command]
pub async fn list_google_analytics_properties(
    project_id: String,
    client_id: String,
    site_url: String,
) -> Result<super::models::Ga4Discovery, String> {
    validation::site_scope(&site_url)?;
    let (client, access_token) = access_context(&project_id, &client_id).await?;
    discover(&client, &access_token, &site_url).await
}

#[tauri::command]
pub async fn google_analytics_performance(
    project_id: String,
    client_id: String,
    site_url: String,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<super::models::Ga4Snapshot, String> {
    validation::site_scope(&site_url)?;
    let (start, end) = dates::requested_date_range(start_date.as_deref(), end_date.as_deref())?;
    let (client, access_token) = access_context(&project_id, &client_id).await?;
    collect(&client, &access_token, &site_url, &start, &end).await
}

fn analytics_client(built: reqwest::Result<reqwest::Client>) -> Result<reqwest::Client, String> {
    built.map_err(|_| "Unable to initialize the Google Analytics client.".to_string())
}

async fn access_context(
    project_id: &str,
    client_id: &str,
) -> Result<(reqwest::Client, String), String> {
    let client_id = credentials::validate_client_id(client_id)?;
    credentials::refresh_token_key(project_id)?;
    let client = analytics_client(
        reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build(),
    )?;
    let store = NativeCredentialStore;
    let access_token = tokens::refresh_access_token_with_store(
        &client,
        project_id,
        &client_id,
        &store,
        session::TOKEN_ENDPOINT,
    )
    .await?;
    Ok((client, access_token))
}

#[cfg(test)]
mod tests {
    #[test]
    fn a_failed_client_build_is_reported_without_provider_detail() {
        let failed = reqwest::Client::new()
            .get("not a url")
            .build()
            .map(|_| reqwest::Client::new());
        assert_eq!(
            super::analytics_client(failed).unwrap_err(),
            "Unable to initialize the Google Analytics client."
        );
    }
}
