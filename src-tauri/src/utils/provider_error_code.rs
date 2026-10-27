//! Closed vocabulary of provider failure reasons.
//!
//! A failed provider response may name a machine-readable reason. Only the
//! fixed codes and hints listed here can reach an error message; text from the
//! provider is compared against the list and never interpolated.

use serde_json::Value;

/// Bytes of a failed response that are inspected for a known reason.
pub(crate) const ERROR_BODY_LIMIT: usize = 16 * 1024;

const ENABLE_API: &str =
    "Enable this API in the Google Cloud project that owns the credentials, wait a few minutes and try again.";
const QUOTA: &str = "The provider quota or rate limit is exhausted. Try again later.";
const SCOPE: &str = "The granted access does not cover this request. Disconnect, then connect again and accept every requested permission.";

/// Most specific reasons first: the first candidate found in this list wins.
const KNOWN_REASONS: &[(&str, &str)] = &[
    ("SERVICE_DISABLED", ENABLE_API),
    ("accessNotConfigured", ENABLE_API),
    ("API_KEY_INVALID", "The API key is not valid for this API. Check the key and its API restrictions."),
    ("ACCESS_TOKEN_SCOPE_INSUFFICIENT", SCOPE),
    ("insufficientPermissions", SCOPE),
    ("rateLimitExceeded", QUOTA),
    ("quotaExceeded", QUOTA),
    ("invalid_client", "Google rejected the OAuth client. Paste the Client ID and the client secret of the same Desktop app OAuth client."),
    ("invalid_request", "Google rejected the sign-in request. A Desktop app OAuth client needs its client secret: paste it and connect again."),
    ("invalid_grant", "The sign-in expired or access was revoked. Connect the account again."),
    ("server_error", "The OAuth provider could not complete the request. Try again later."),
    ("temporarily_unavailable", "The OAuth provider is temporarily unavailable. Try again later."),
    ("redirect_uri_mismatch", "Use an OAuth client of type Desktop app. A Web application client rejects the local callback address."),
    ("unauthorized_client", "This OAuth client may not use this sign-in flow. Create an OAuth client of type Desktop app."),
    ("access_denied", "Access was denied. While the consent screen is in testing, add the Google account as a test user."),
    ("PERMISSION_DENIED", "The signed-in account or key has no access to this resource."),
    ("UNAUTHENTICATED", "The credentials were not accepted. Connect the account again."),
    ("RESOURCE_EXHAUSTED", QUOTA),
];

fn reason_strings(items: Option<&Value>) -> impl Iterator<Item = &str> {
    items
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| item.get("reason").and_then(Value::as_str))
}

/// The fixed code and hint for a failed response body, when it names a known reason.
pub(crate) fn known_reason(body: &Value) -> Option<(&'static str, &'static str)> {
    let error = body.get("error")?;
    let candidates: Vec<&str> = reason_strings(error.get("details"))
        .chain(reason_strings(error.get("errors")))
        .chain(error.get("status").and_then(Value::as_str))
        .chain(error.as_str())
        .collect();
    KNOWN_REASONS
        .iter()
        .find(|(code, _)| candidates.contains(code))
        .copied()
}

#[cfg(test)]
#[path = "provider_error_code_tests.rs"]
mod tests;
