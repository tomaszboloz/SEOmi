use super::send_windows_artifact_result;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

#[test]
fn sender_delivers_success_once() {
    let (sender, mut receiver) = oneshot::channel();
    let shared = Arc::new(Mutex::new(Some(sender)));

    send_windows_artifact_result(&shared, Ok(vec![1, 2, 3]));
    assert_eq!(receiver.try_recv().unwrap(), Ok(vec![1, 2, 3]));

    send_windows_artifact_result(&shared, Err("late result".into()));
    assert!(shared.lock().unwrap().is_none());
}

#[test]
fn sender_preserves_callback_error() {
    let (sender, mut receiver) = oneshot::channel();
    let shared = Arc::new(Mutex::new(Some(sender)));

    send_windows_artifact_result(&shared, Err("callback failed".into()));
    assert_eq!(receiver.try_recv().unwrap(), Err("callback failed".into()));
}
