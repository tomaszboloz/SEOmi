use super::callback_io::{read_callback_request, write_callback_response};
use tokio::{
    net::TcpListener,
    time::{timeout, Duration},
};
use url::Url;

const TOKEN_TIMEOUT: Duration = Duration::from_secs(180);

pub(super) async fn receive_oauth_code(
    listener: TcpListener,
    expected_state: &str,
) -> Result<String, String> {
    timeout(TOKEN_TIMEOUT, async move {
        loop {
            let (mut stream, _) = listener
                .accept()
                .await
                .map_err(|error| format!("Unable to receive the OAuth response: {error}"))?;
            let request = match read_callback_request(&mut stream, Duration::from_secs(5)).await {
                Ok(request) => request,
                Err(_) => {
                    let _ = write_callback_response(
                        &mut stream,
                        "400 Bad Request",
                        "Invalid or incomplete OAuth callback request.",
                    )
                    .await;
                    continue;
                }
            };
            let path = request
                .lines()
                .next()
                .and_then(|line| line.split_whitespace().nth(1))
                .unwrap_or("/");
            let callback = Url::parse(&format!("http://127.0.0.1{path}"))
                .map_err(|_| "Google returned an invalid OAuth URL.".to_string())?;
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
                    "OAuth state verification failed. You can close this tab.",
                )
                .await;
                continue;
            }
            if let Some(error) = query.get("error") {
                let _ = write_callback_response(
                    &mut stream,
                    "400 Bad Request",
                    "Google authorization was cancelled. You can close this tab.",
                )
                .await;
                return Err(if error == "access_denied" {
                    "Search Console authorization was cancelled by the user.".into()
                } else if let Some((code, hint)) = crate::utils::provider_error_code::known_reason(
                    &serde_json::json!({"error": error}),
                ) {
                    format!("Google OAuth failed: {code}. {hint}")
                } else {
                    "Google OAuth failed.".into()
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
                "SEOmi received the Google response. Return to the app and close this tab.",
            )
            .await?;
            return Ok(code);
        }
    })
    .await
    .map_err(|_| "Google sign-in did not finish within 3 minutes. If Google showed an error page instead of returning to SEOmi, its error code names the cause (access_denied: add the account as an OAuth test user; redirect_uri_mismatch: use a Desktop app OAuth client).".to_string())?
}
