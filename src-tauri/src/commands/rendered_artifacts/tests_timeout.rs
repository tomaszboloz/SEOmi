#[cfg(target_os = "macos")]
use super::macos::wait_for_artifact;
#[cfg(target_os = "macos")]
use std::time::Duration;
#[cfg(target_os = "macos")]
use tokio::sync::oneshot;

#[cfg(target_os = "macos")]
#[tokio::test]
async fn wait_for_artifact_handles_success_timeout_and_channel_closure() {
    let (tx, rx) = oneshot::channel();
    let _ = tx.send(Ok(vec![1, 2, 3]));
    let res = wait_for_artifact(rx, Duration::from_secs(1)).await;
    assert_eq!(res.unwrap(), vec![1, 2, 3]);

    let (_tx_hang, rx_hang) = oneshot::channel::<Result<Vec<u8>, String>>();
    let timeout_err = wait_for_artifact(rx_hang, Duration::from_millis(5))
        .await
        .unwrap_err();
    assert_eq!(
        timeout_err,
        "macOS rendered artifact capture timed out after 30 seconds."
    );

    let (tx_drop, rx_drop) = oneshot::channel::<Result<Vec<u8>, String>>();
    drop(tx_drop);
    let closed_err = wait_for_artifact(rx_drop, Duration::from_secs(1))
        .await
        .unwrap_err();
    assert_eq!(
        closed_err,
        "macOS rendered artifact capture channel closed."
    );
}

#[cfg(target_os = "macos")]
#[test]
fn artifact_conversions_and_sender_handle_edge_cases() {
    use super::macos::{
        ns_data_bytes, pdf_result, screenshot_data_result, screenshot_result, send_artifact_result,
    };
    use objc2_foundation::NSData;
    use std::sync::{Arc, Mutex};

    assert!(screenshot_result(None).is_err());
    assert!(pdf_result(None).is_err());

    let empty_data = NSData::new();
    assert_eq!(ns_data_bytes(&empty_data), Vec::<u8>::new());
    assert_eq!(pdf_result(Some(&empty_data)).unwrap(), Vec::<u8>::new());
    assert!(screenshot_data_result(&empty_data).is_err());

    let sender = Arc::new(Mutex::new(None));
    send_artifact_result(&sender, Ok(vec![1, 2, 3]));
}
