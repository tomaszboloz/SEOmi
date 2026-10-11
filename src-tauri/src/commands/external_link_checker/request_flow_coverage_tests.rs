use super::{is_redirect, run, should_fallback_to_get};
use crate::commands::external_link_checker::{
    concurrency::new_host_gates, network::client_for_url, result::new_chain_state,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

#[test]
fn should_fallback_to_get_covers_all_status_codes() {
    for code in [403, 404, 405, 429, 501, 500, 502, 503, 599] {
        assert!(should_fallback_to_get(code), "{code} should fallback");
    }
    for code in [200, 204, 301, 302, 304, 400, 401, 418, 499] {
        assert!(!should_fallback_to_get(code), "{code} should not fallback");
    }
}

#[test]
fn is_redirect_covers_all_supported_status_codes() {
    for code in [301, 302, 303, 307, 308] {
        assert!(is_redirect(code), "{code} should be redirect");
    }
    for code in [200, 300, 304, 305, 306, 404, 500] {
        assert!(!is_redirect(code), "{code} should not be redirect");
    }
}

#[tokio::test]
async fn normalization_distinguishes_blocked_and_invalid_kinds() {
    for (url, expected) in [
        ("http://127.0.0.1/private", "blocked"),
        ("http://printer.local/status", "blocked"),
        ("http://router.internal/admin", "blocked"),
        ("https://user:pass@example.com/", "invalid"),
        ("not-a-valid-url", "invalid"),
        ("ftp://example.com/file", "invalid"),
    ] {
        let state = new_chain_state();
        let res = run(
            url.into(),
            |_| async { Ok(vec![]) },
            |_, _| Err("unused".into()),
            None,
            state,
        )
        .await;
        assert_eq!(res.request_error_kind.as_deref(), Some(expected), "{url}");
    }
}

#[tokio::test]
async fn run_handles_resolver_errors_and_gate_concurrency() {
    let gates = new_host_gates();
    for (err_msg, expected_kind) in [
        ("DNS lookup failed: NXDOMAIN", "dns"),
        ("lookup timed out", "timeout"),
        ("SSRF blocked", "blocked"),
    ] {
        let state = new_chain_state();
        let res = run(
            "http://example.com/item".into(),
            |_| async move { Err(err_msg.into()) },
            |_, _| Err("unused".into()),
            Some(gates.clone()),
            state,
        )
        .await;
        assert_eq!(res.request_error_kind.as_deref(), Some(expected_kind));
    }
}

#[tokio::test]
async fn run_fallback_to_get_on_403_and_500() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        for (head_status, get_status) in [(403, 200), (500, 200), (404, 404)] {
            let (mut s1, _) = listener.accept().await.unwrap();
            let mut req1 = [0u8; 1024];
            let _ = s1.read(&mut req1).await.unwrap();
            let h_res = format!("HTTP/1.1 {head_status} Err\r\nContent-Length: 0\r\n\r\n");
            s1.write_all(h_res.as_bytes()).await.unwrap();

            let (mut s2, _) = listener.accept().await.unwrap();
            let mut req2 = [0u8; 1024];
            let _ = s2.read(&mut req2).await.unwrap();
            let g_res = format!("HTTP/1.1 {get_status} OK\r\nContent-Length: 0\r\n\r\n");
            s2.write_all(g_res.as_bytes()).await.unwrap();
        }
    });

    for expected in [200, 200, 404] {
        let state = new_chain_state();
        let res = run(
            format!("http://seomi.test:{}/test", addr.port()),
            move |_| async move { Ok(vec![addr]) },
            client_for_url,
            None,
            state,
        )
        .await;
        assert_eq!(res.http_status, Some(expected));
    }
    server.await.unwrap();
}

#[tokio::test]
async fn run_handles_redirect_to_private_target() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut s, _) = listener.accept().await.unwrap();
        let mut req = [0u8; 1024];
        let _ = s.read(&mut req).await.unwrap();
        s.write_all(b"HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1/private\r\nContent-Length: 0\r\n\r\n").await.unwrap();
    });

    let state = new_chain_state();
    let res = run(
        format!("http://seomi.test:{}/redirect-private", addr.port()),
        move |_| async move { Ok(vec![addr]) },
        client_for_url,
        None,
        state,
    )
    .await;
    server.await.unwrap();
    assert_eq!(res.http_status, Some(302));
    assert_eq!(res.request_error_kind.as_deref(), Some("unverifiable"));
}
