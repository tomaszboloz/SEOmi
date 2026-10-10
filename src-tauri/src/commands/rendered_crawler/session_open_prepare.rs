use url::Url;

use super::models::RenderOptions;
use crate::utils::url_validator::validate_and_normalize_url;

#[derive(Debug)]
pub(crate) struct PreparedSessionOpen {
    pub(crate) start_url: Url,
    pub(crate) base_host: String,
    pub(crate) allow_subdomains: bool,
    pub(crate) scope_path: Option<String>,
    pub(crate) options: RenderOptions,
}

pub(crate) fn prepare_session_open(
    start_url: &str,
    base_host: &str,
    allow_subdomains: bool,
    scope_path: Option<&str>,
    options: RenderOptions,
) -> Result<PreparedSessionOpen, String> {
    let start_url = validate_and_normalize_url(start_url).map_err(|error| error.to_string())?;
    Ok(PreparedSessionOpen {
        start_url,
        base_host: base_host.to_ascii_lowercase(),
        allow_subdomains,
        scope_path: scope_path.map(str::to_owned),
        options,
    })
}
