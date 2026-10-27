use super::super::{
    connect, credentials, dates,
    session::{self, ConnectDependencies, CredentialStore, NativeCredentialStore},
    tokens,
};
use super::{admin, collect_at, report, validation};
use std::time::Duration;

pub(super) const GA4_OAUTH_SCOPE: &str =
    "https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly";

pub(super) struct Endpoints<'a> {
    pub(super) token: &'a str,
    pub(super) accounts: &'a str,
    pub(super) admin: &'a str,
    pub(super) data: &'a str,
}

pub(super) const PRODUCTION: Endpoints<'static> = Endpoints {
    token: session::TOKEN_ENDPOINT,
    accounts: admin::ACCOUNT_SUMMARIES_ENDPOINT,
    admin: admin::ADMIN_API_BASE,
    data: report::DATA_API_BASE,
};

type Sites = Vec<super::super::models::GscSiteProperty>;

#[tauri::command]
pub async fn connect_google_analytics(
    project_id: String,
    client_id: String,
    client_secret: Option<String>,
) -> Result<Sites, String> {
    connect_with(
        project_id,
        client_id,
        client_secret,
        &NativeCredentialStore,
        ConnectDependencies::production,
    )
    .await
}

pub(super) async fn connect_with<'a, F>(
    project_id: String,
    client_id: String,
    client_secret: Option<String>,
    store: &'a dyn CredentialStore,
    dependencies: F,
) -> Result<Sites, String>
where
    F: FnOnce(&'a dyn CredentialStore) -> ConnectDependencies<'a>,
{
    credentials::validate_client_id(&client_id)?;
    credentials::refresh_token_key(&project_id)?;
    connect::connect_with_scope(
        project_id,
        client_id,
        client_secret,
        dependencies(store),
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
    let ids = (project_id.as_str(), client_id.as_str());
    list_with(ids, &site_url, &NativeCredentialStore, &PRODUCTION).await
}

pub(super) async fn list_with(
    (project_id, client_id): (&str, &str),
    site_url: &str,
    store: &dyn CredentialStore,
    endpoints: &Endpoints<'_>,
) -> Result<super::models::Ga4Discovery, String> {
    let (client, token) = access_context(project_id, client_id, store, endpoints).await?;
    let (accounts, admin_base) = (endpoints.accounts, endpoints.admin);
    admin::discover_at(&client, &token, site_url, accounts, admin_base).await
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
    let range = dates::requested_date_range(start_date.as_deref(), end_date.as_deref())?;
    let ids = (project_id.as_str(), client_id.as_str());
    let range = (range.0.as_str(), range.1.as_str());
    performance_with(ids, &site_url, range, &NativeCredentialStore, &PRODUCTION).await
}

pub(super) async fn performance_with(
    (project_id, client_id): (&str, &str),
    site_url: &str,
    (start, end): (&str, &str),
    store: &dyn CredentialStore,
    endpoints: &Endpoints<'_>,
) -> Result<super::models::Ga4Snapshot, String> {
    let (client, token) = access_context(project_id, client_id, store, endpoints).await?;
    let (accounts, admin_base, data) = (endpoints.accounts, endpoints.admin, endpoints.data);
    collect_at(
        &client, &token, site_url, start, end, accounts, admin_base, data,
    )
    .await
}

fn analytics_client(built: reqwest::Result<reqwest::Client>) -> Result<reqwest::Client, String> {
    built.map_err(|_| "Unable to initialize the Google Analytics client.".to_string())
}

async fn access_context(
    project_id: &str,
    client_id: &str,
    store: &dyn CredentialStore,
    endpoints: &Endpoints<'_>,
) -> Result<(reqwest::Client, String), String> {
    let client_id = credentials::validate_client_id(client_id)?;
    credentials::refresh_token_key(project_id)?;
    let client = analytics_client(
        reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build(),
    )?;
    let token = tokens::refresh_access_token_with_store(
        &client,
        project_id,
        &client_id,
        store,
        endpoints.token,
    )
    .await?;
    Ok((client, token))
}

#[cfg(test)]
#[path = "commands_with_tests.rs"]
mod with_tests;
