use super::public_resolver;
use url::Url;

#[tokio::test]
async fn production_resolver_rejects_private_literal_addresses_without_network() {
    for target in ["http://127.0.0.1/", "https://[::1]/", "http://10.0.0.1/"] {
        let error = public_resolver(Url::parse(target).unwrap())
            .await
            .unwrap_err();
        assert!(
            error.to_string().contains("private or reserved"),
            "{target}"
        );
    }
}

#[tokio::test]
async fn production_resolver_keeps_explicit_and_default_ports_for_public_literals() {
    for (target, expected) in [
        ("https://93.184.216.34/", "93.184.216.34:443"),
        ("http://93.184.216.34:8080/", "93.184.216.34:8080"),
    ] {
        let addresses = public_resolver(Url::parse(target).unwrap()).await.unwrap();
        assert_eq!(addresses, vec![expected.parse().unwrap()]);
    }
}
