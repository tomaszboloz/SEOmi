use super::{
    concurrency::HostGates,
    models::ExternalLinkCheck,
    result::{new_chain_state, timeout_result},
};
use std::{future::Future, net::SocketAddr, time::Duration};
use url::Url;

const MAX_CHECK_DURATION: Duration = Duration::from_secs(30);

#[cfg(test)]
pub(super) async fn check_with<R, F, B>(input: String, resolve: R, build: B) -> ExternalLinkCheck
where
    R: FnMut(Url) -> F,
    F: Future<Output = Result<Vec<SocketAddr>, String>>,
    B: FnMut(&Url, &[SocketAddr]) -> Result<reqwest::Client, String>,
{
    check_with_gates(input, resolve, build, None).await
}

pub(super) async fn check_with_gates<R, F, B>(
    input: String,
    resolve: R,
    build: B,
    gates: Option<HostGates>,
) -> ExternalLinkCheck
where
    R: FnMut(Url) -> F,
    F: Future<Output = Result<Vec<SocketAddr>, String>>,
    B: FnMut(&Url, &[SocketAddr]) -> Result<reqwest::Client, String>,
{
    let original = input.clone();
    let state = new_chain_state();
    match tokio::time::timeout(
        MAX_CHECK_DURATION,
        super::request_flow::run(input, resolve, build, gates, state.clone()),
    )
    .await
    {
        Ok(result) => result,
        Err(_) => timeout_result(original, &state),
    }
}
