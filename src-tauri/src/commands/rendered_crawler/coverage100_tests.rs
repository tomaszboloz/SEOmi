use super::session::{
    destroy_requested, destroyed_listener, destruction_acknowledged, report_close_failure,
};
use std::sync::{Arc, Mutex};
use tauri::WindowEvent;
use tokio::sync::oneshot;
use tokio::time::Duration;

#[tokio::test]
async fn session_lifecycle_helpers_cover_acknowledgement_and_events() {
    let (sender, receiver) = oneshot::channel();
    let slot = Arc::new(Mutex::new(Some(sender)));
    let listener = destroyed_listener(slot.clone());
    listener(&WindowEvent::Focused(true));
    assert!(slot.lock().unwrap().is_some());
    listener(&WindowEvent::Destroyed);
    assert!(receiver.await.is_ok());
    assert!(destroy_requested(Ok(())));

    let (sender, receiver) = oneshot::channel();
    sender.send(()).unwrap();
    assert!(destruction_acknowledged(receiver, Duration::from_secs(1)).await);

    let (sender, receiver) = oneshot::channel::<()>();
    drop(sender);
    assert!(!destruction_acknowledged(receiver, Duration::from_secs(1)).await);
    let (_sender, receiver) = oneshot::channel::<()>();
    assert!(!destruction_acknowledged(receiver, Duration::from_millis(1)).await);
    report_close_failure(Err(tauri::Error::FailedToReceiveMessage));
}
