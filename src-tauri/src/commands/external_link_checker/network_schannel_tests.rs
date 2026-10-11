use super::super::error_kind;
use std::sync::Arc;

struct SchannelFailureResolver;
impl reqwest::dns::Resolve for SchannelFailureResolver {
    fn resolve(&self, _: reqwest::dns::Name) -> reqwest::dns::Resolving {
        Box::pin(async { Err(std::io::Error::from_raw_os_error(0x80090326u32 as i32).into()) })
    }
}

#[tokio::test]
async fn reqwest_error_chain_preserves_numeric_schannel_failure_classification() {
    let error = reqwest::Client::builder()
        .no_proxy()
        .dns_resolver(Arc::new(SchannelFailureResolver))
        .build()
        .unwrap()
        .get("https://schannel-fixture.test/")
        .send()
        .await
        .unwrap_err();
    assert!(error.is_connect());
    assert_eq!(error_kind(&error), "tls", "{error:?}");
}
