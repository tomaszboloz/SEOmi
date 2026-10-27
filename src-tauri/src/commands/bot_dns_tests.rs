use super::*;

#[test]
fn only_public_ip_literals_are_accepted() {
    assert_eq!(parse_public_ip(" 8.8.8.8 ").unwrap().to_string(), "8.8.8.8");
    assert!(parse_public_ip("2001:4860:4860::8888").is_ok());
    for blocked in [
        "127.0.0.1",
        "10.0.0.5",
        "192.168.1.1",
        "169.254.1.1",
        "::1",
        "fe80::1",
        "0.0.0.0",
    ] {
        assert_eq!(
            parse_public_ip(blocked).unwrap_err(),
            "Only public IP addresses can be verified",
            "{blocked}"
        );
    }
    assert_eq!(
        parse_public_ip("not-an-ip").unwrap_err(),
        "Invalid IP address"
    );
    assert_eq!(parse_public_ip("").unwrap_err(), "Invalid IP address");
}

#[test]
fn host_validation_rejects_malformed_names() {
    assert!(valid_host("crawl-66-249-66-1.googlebot.com"));
    assert!(valid_host("crawl.googlebot.com."));
    for bad in [
        "localhost",
        "",
        "a..b.com",
        "-a.example.com",
        "a-.example.com",
        "exa mple.com",
        "a/b.example.com",
        "x.example.com:80",
        "ex_ample.com",
    ] {
        assert!(!valid_host(bad), "{bad:?}");
    }
    assert!(!valid_host(&format!("{}.com", "a".repeat(64))));
    assert!(!valid_host(&format!("{}.com", "a.".repeat(130))));
}

#[tokio::test]
async fn commands_refuse_internal_targets_without_touching_the_network() {
    assert_eq!(
        dns_reverse("127.0.0.1".into()).await.unwrap_err(),
        "Only public IP addresses can be verified"
    );
    assert_eq!(
        dns_reverse("bad".into()).await.unwrap_err(),
        "Invalid IP address"
    );
    assert_eq!(
        dns_forward("localhost".into()).await.unwrap_err(),
        "Invalid host name"
    );
    assert_eq!(
        dns_forward("bad host.example.com".into())
            .await
            .unwrap_err(),
        "Invalid host name"
    );
}

#[tokio::test]
async fn forward_lookup_drops_non_public_answers() {
    // `localhost.localdomain`-style names resolve to loopback only; none of it may be returned.
    let answers = dns_forward("localhost.localdomain".into())
        .await
        .unwrap_or_default();
    assert!(answers
        .iter()
        .all(|address| parse_public_ip(address).is_ok()));
}
