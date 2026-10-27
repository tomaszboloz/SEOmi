use super::fixture::{handle, serve};
use super::{check_for_updates, install_update, install_update_step};

#[tokio::test]
async fn invalid_endpoint_yields_update_check_error() {
    let err = check_for_updates(handle(Some("http://127.0.0.1:0/invalid")))
        .await
        .unwrap_err();
    assert!(err.starts_with("Update check failed:"), "{err}");

    let err = install_update(handle(Some("http://127.0.0.1:0/invalid")))
        .await
        .unwrap_err();
    assert!(err.starts_with("Update check failed:"), "{err}");
}

#[tokio::test]
async fn install_update_step_succeeds_when_installer_completes() {
    let (url, done) = serve(
        "200 OK",
        br#"{"version":"0.2.0","url":"https://u.test","signature":"s"}"#,
    )
    .await;
    let result = install_update_step(handle(Some(&url)), |_| async { Ok(()) })
        .await
        .unwrap();
    done.await.unwrap();
    assert!(result.available);
    assert!(result.installed);
    assert!(result.restart_required);
    assert_eq!(result.version.as_deref(), Some("0.2.0"));
}

#[tokio::test]
async fn install_update_step_propagates_installer_error() {
    let (url, done) = serve(
        "200 OK",
        br#"{"version":"0.2.0","url":"https://u.test","signature":"s"}"#,
    )
    .await;
    let err = install_update_step(handle(Some(&url)), |_| async {
        Err("custom install error".into())
    })
    .await
    .unwrap_err();
    done.await.unwrap();
    assert_eq!(err, "custom install error");
}
