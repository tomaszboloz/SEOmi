use super::resolver::*;
use std::time::Duration;
use tokio::time::timeout;

#[tokio::test]
async fn shared_client_blocks_private_dns_before_opening_a_socket() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let client = public_client_builder_with_lookup(move |host| async move {
        assert_eq!(host, "crawl.example");
        Ok(vec![address])
    })
    .build()
    .unwrap();
    let error = client
        .get("http://crawl.example/")
        .send()
        .await
        .unwrap_err();
    assert!(format!("{error:?}").contains("private or reserved"));
    assert!(timeout(Duration::from_millis(20), listener.accept())
        .await
        .is_err());
}

#[tokio::test]
async fn shared_resolver_checks_every_address_and_does_not_fabricate_dns_success() {
    use reqwest::dns::Resolve;
    for addresses in [
        vec![],
        vec!["1.1.1.1:0".parse().unwrap(), "127.0.0.1:0".parse().unwrap()],
    ] {
        let resolver = ValidatedResolver {
            lookup: move |_host| {
                let addresses = addresses.clone();
                async move { Ok(addresses) }
            },
        };
        assert!(resolver
            .resolve("crawl.example".parse().unwrap())
            .await
            .is_err());
    }
    let resolver = ValidatedResolver {
        lookup: |_host| async {
            Ok(vec![
                "1.1.1.1:0".parse().unwrap(),
                "[2606:4700:4700::1111]:0".parse().unwrap(),
            ])
        },
    };
    assert_eq!(
        resolver
            .resolve("crawl.example".parse().unwrap())
            .await
            .unwrap()
            .count(),
        2
    );
    let resolver = ValidatedResolver {
        lookup: |_host| async {
            Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "DNS failed",
            ))
        },
    };
    assert!(resolver
        .resolve("crawl.example".parse().unwrap())
        .await
        .is_err());
}
