use super::*;

#[test]
fn classifies_individual_transport_markers_and_precedence() {
    let categories: &[(&str, &[&str])] = &[
        ("timeout", &["timed out", "timeout", "deadline has elapsed"]),
        (
            "dns",
            &[
                "dns",
                "name or service not known",
                "temporary failure in name resolution",
                "failed to lookup address",
                "could not resolve host",
                "nodename nor servname",
                "no such host",
            ],
        ),
        (
            "tls",
            &[
                "tls",
                "certificate",
                "unknown ca",
                "invalid peer certificate",
                "handshake failure",
                "rustls",
                "native-tls",
            ],
        ),
        (
            "connect",
            &[
                "connection refused",
                "connection reset",
                "connection aborted",
                "failed to connect",
                "connect error",
                "network is unreachable",
            ],
        ),
    ];
    for (category, markers) in categories {
        for marker in *markers {
            assert_eq!(
                classify_request_error(false, false, marker),
                *category,
                "{marker}"
            );
            assert_eq!(
                classify_request_error(false, false, &marker.to_uppercase()),
                *category
            );
        }
    }
    assert_eq!(classify_request_error(true, false, ""), "timeout");
    assert_eq!(classify_request_error(false, true, ""), "connect");
    assert_eq!(classify_request_error(false, false, ""), "network");
    assert_eq!(
        classify_request_error(true, true, "dns certificate"),
        "timeout"
    );
    assert_eq!(
        classify_request_error(false, true, "dns certificate"),
        "dns"
    );
    assert_eq!(classify_request_error(false, true, "certificate"), "tls");
}

#[tokio::test]
async fn request_error_kind_classifies_real_builder_and_closed_socket_errors() {
    let client = reqwest::Client::builder().no_proxy().build().unwrap();
    let malformed = client.get("not a URL").send().await.unwrap_err();
    assert_eq!(request_error_kind(&malformed), "network");
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    drop(listener);
    let refused = client
        .get(format!("http://{address}/"))
        .send()
        .await
        .unwrap_err();
    assert_eq!(request_error_kind(&refused), "connect");
}
