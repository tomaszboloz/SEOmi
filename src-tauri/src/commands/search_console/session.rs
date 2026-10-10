use super::{
    browser::{send_browser_to, BrowserLauncher},
    callback::receive_oauth_code,
};
use crate::commands::settings::secret_entry;
use std::{future::Future, pin::Pin};
use tokio::net::TcpListener;

pub(super) const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
pub(super) const SITES_ENDPOINT: &str = "https://searchconsole.googleapis.com/webmasters/v3/sites";

pub(super) enum CredentialReadError {
    Store(String),
    Value,
}

pub(super) trait CredentialStore: Send + Sync {
    fn read(&self, name: &str) -> Result<Option<String>, CredentialReadError>;
    fn write(&self, name: &str, value: &str) -> Result<(), String>;
}

pub(super) struct NativeCredentialStore;

impl CredentialStore for NativeCredentialStore {
    fn read(&self, name: &str) -> Result<Option<String>, CredentialReadError> {
        let entry = secret_entry(name).map_err(CredentialReadError::Store)?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(CredentialReadError::Value),
        }
    }

    fn write(&self, name: &str, value: &str) -> Result<(), String> {
        secret_entry(name)?
            .set_password(value)
            .map_err(|error| error.to_string())
    }
}

pub(super) type ReceiveCode =
    for<'a> fn(
        TcpListener,
        &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + 'a>>;

pub(super) fn receive_code(
    listener: TcpListener,
    state: &str,
) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + '_>> {
    Box::pin(receive_oauth_code(listener, state))
}

pub(super) struct ConnectDependencies<'a> {
    pub(super) credentials: &'a dyn CredentialStore,
    pub(super) open_browser: BrowserLauncher,
    pub(super) receive_code: ReceiveCode,
    pub(super) token_endpoint: &'a str,
    pub(super) sites_endpoint: &'a str,
}

impl<'a> ConnectDependencies<'a> {
    pub(super) fn production(credentials: &'a dyn CredentialStore) -> Self {
        Self {
            credentials,
            open_browser: send_browser_to,
            receive_code,
            token_endpoint: TOKEN_ENDPOINT,
            sites_endpoint: SITES_ENDPOINT,
        }
    }
}
