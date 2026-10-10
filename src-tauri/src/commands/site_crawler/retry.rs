use chrono::{DateTime, Utc};
use reqwest::{header::RETRY_AFTER, Client};
use std::time::Duration;

#[path = "retry_types.rs"]
mod types;
pub(crate) use types::{RetriedResponse, RetryBudget, RetryContext, RetryError};

pub(crate) const MAX_RETRY_AFTER: Duration = Duration::from_secs(30);

pub(crate) fn retryable_status(status: u16) -> bool {
    matches!(status, 429 | 502 | 503 | 504)
}

pub(crate) fn retry_after_delay(value: &str, now: DateTime<Utc>) -> Option<Duration> {
    let seconds = value.trim().parse::<u64>().ok().or_else(|| {
        DateTime::parse_from_rfc2822(value)
            .ok()
            .map(|date| (date.with_timezone(&Utc) - now).num_seconds().max(0) as u64)
    })?;
    Some(Duration::from_secs(seconds).min(MAX_RETRY_AFTER))
}

async fn wait_for_retry(context: &RetryContext, delay: Duration) -> Result<(), RetryError> {
    if let Some(remaining) = context.remaining() {
        if remaining < delay {
            tokio::time::sleep(remaining).await;
            return Err(RetryError::Deadline);
        }
    }
    tokio::time::sleep(delay).await;
    if context
        .remaining()
        .is_some_and(|remaining| remaining.is_zero())
    {
        return Err(RetryError::Deadline);
    }
    Ok(())
}

async fn send_once(
    client: &Client,
    url: &str,
    context: &RetryContext,
) -> Result<reqwest::Response, RetryError> {
    let request = client.get(url).send();
    match context.remaining() {
        Some(remaining) if remaining.is_zero() => Err(RetryError::Deadline),
        Some(remaining) => tokio::time::timeout(remaining, request)
            .await
            .map_err(|_| RetryError::Deadline)?
            .map_err(RetryError::Request),
        None => request.await.map_err(RetryError::Request),
    }
}

pub(crate) async fn send_get_with_retry(
    client: &Client,
    url: &str,
    context: &RetryContext,
    retry_available: &mut bool,
) -> Result<RetriedResponse, RetryError> {
    let mut retries = 0;
    loop {
        let response = match send_once(client, url, context).await {
            Ok(response) => response,
            Err(RetryError::Request(request_error))
                if (request_error.is_connect() || request_error.is_timeout())
                    && *retry_available
                    && context.budget.take() =>
            {
                *retry_available = false;
                retries += 1;
                wait_for_retry(context, Duration::ZERO).await?;
                continue;
            }
            Err(error) => return Err(error),
        };
        if !retryable_status(response.status().as_u16())
            || !*retry_available
            || !context.budget.take()
        {
            return Ok(RetriedResponse { response, retries });
        }
        let delay = response
            .headers()
            .get(RETRY_AFTER)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| retry_after_delay(value, Utc::now()))
            .unwrap_or_default();
        *retry_available = false;
        retries += 1;
        drop(response);
        wait_for_retry(context, delay).await?;
    }
}

pub(crate) async fn read_response_chunk(
    response: &mut reqwest::Response,
    context: &RetryContext,
) -> Result<Option<Vec<u8>>, RetryError> {
    let chunk = match context.remaining() {
        Some(remaining) if remaining.is_zero() => return Err(RetryError::Deadline),
        Some(remaining) => tokio::time::timeout(remaining, response.chunk())
            .await
            .map_err(|_| RetryError::Deadline)?
            .map_err(RetryError::Request)?,
        None => response.chunk().await.map_err(RetryError::Request)?,
    };
    Ok(chunk.map(|value| value.to_vec()))
}

pub(crate) async fn read_bounded_text_with_retry(
    mut response: reqwest::Response,
    limit: usize,
    context: &RetryContext,
) -> Result<String, String> {
    let limit = limit.min(crate::services::http_client::models::MAX_BODY_BYTES);
    let mut bytes = Vec::new();
    while let Some(chunk) = read_response_chunk(&mut response, context)
        .await
        .map_err(|error| error.to_string())?
    {
        if chunk.len() > limit.saturating_sub(bytes.len()) {
            return Err(format!(
                "Response size exceeds safety limit of {limit} bytes"
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(String::from_utf8_lossy(&bytes).to_string())
}

#[cfg(test)]
#[path = "retry_tests.rs"]
mod tests;
