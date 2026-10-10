use super::{check_for_updates_with, install_update_with};
#[path = "updater_contract_fixture.rs"]
mod fixture;
use fixture::{handle, serve};

#[tokio::test]
async fn check_command_maps_empty_and_available_responses() {
    let (url, done) = serve("204 No Content", b"").await;
    let result = super::check_for_updates(handle(Some(&url))).await.unwrap();
    done.await.unwrap();
    assert!(!result.available && result.current_version == env!("CARGO_PKG_VERSION"));

    let (url, done) = serve(
        "200 OK",
        br#"{"version":"0.2.0","url":"https://u.test","signature":"s"}"#,
    )
    .await;
    let result = super::check_for_updates(handle(Some(&url))).await.unwrap();
    done.await.unwrap();
    assert_eq!(
        (result.available, result.installed, result.restart_required),
        (true, false, false)
    );
    assert_eq!(result.version.as_deref(), Some("0.2.0"));
}

#[tokio::test]
async fn commands_preserve_initialization_and_check_errors() {
    assert!(super::check_for_updates(handle(None))
        .await
        .unwrap_err()
        .starts_with("Updater initialization:"));
    let (url, done) = serve("200 OK", b"not-json").await;
    assert!(super::check_for_updates(handle(Some(&url)))
        .await
        .unwrap_err()
        .starts_with("Update check failed:"));
    done.await.unwrap();
    let (url, done) = serve("204 No Content", b"").await;
    assert_eq!(
        super::install_update(handle(Some(&url))).await.unwrap_err(),
        "No update is available"
    );
    done.await.unwrap();
}

#[tokio::test]
async fn install_command_reports_download_or_signature_failures() {
    let (download, download_done) = serve("200 OK", b"not-an-installer").await;
    let body =
        format!("{{\"version\":\"0.2.0\",\"url\":\"{download}\",\"signature\":\"invalid\"}}");
    let (url, endpoint_done) = serve("200 OK", body.as_bytes()).await;
    let error = install_update_with(handle(Some(&url))).await.unwrap_err();
    assert!(error.starts_with("Update installation failed:"), "{error}");
    endpoint_done.await.unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(3), download_done)
        .await
        .unwrap_or_else(|_| panic!("download fixture was not reached: {error}"))
        .unwrap_or_else(|_| panic!("download fixture failed: {error}"));
}

#[tokio::test]
async fn install_preserves_initialization_and_manifest_failures() {
    assert!(super::install_update(handle(None))
        .await
        .unwrap_err()
        .starts_with("Updater initialization:"));
    for (status, body) in [
        ("200 OK", &b"not-json"[..]),
        ("404 Not Found", &b"missing"[..]),
    ] {
        let (url, done) = serve(status, body).await;
        assert!(install_update_with(handle(Some(&url)))
            .await
            .unwrap_err()
            .starts_with("Update check failed:"));
        done.await.unwrap();
    }
}

#[tokio::test]
async fn check_missing_or_older_release_never_offers_installation() {
    for (status, body) in [
        ("404 Not Found", &b"missing"[..]),
        (
            "200 OK",
            &br#"{"version":"0.0.1","url":"https://u.test","signature":"s"}"#[..],
        ),
    ] {
        let (url, done) = serve(status, body).await;
        let result = check_for_updates_with(handle(Some(&url))).await.unwrap();
        done.await.unwrap();
        assert!(
            !result.available
                && !result.installed
                && !result.restart_required
                && result.version.is_none()
        );
    }
}
