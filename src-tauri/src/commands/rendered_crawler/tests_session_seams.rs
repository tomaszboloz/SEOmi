use super::session::{
    destroy_requested, destroyed_listener, destruction_acknowledged, notify_window_destroyed,
    report_close_failure,
};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::WindowEvent;
use tokio::sync::oneshot;

#[test]
fn the_listener_wakes_the_waiter_only_for_a_destroyed_event() {
    let (tx, mut rx) = oneshot::channel();
    let sender = Arc::new(Mutex::new(Some(tx)));
    let listener = destroyed_listener(Arc::clone(&sender));
    listener(&WindowEvent::Focused(true));
    assert!(rx.try_recv().is_err());
    listener(&WindowEvent::Destroyed);
    assert!(rx.try_recv().is_ok());
    listener(&WindowEvent::Destroyed);
}

#[test]
fn a_poisoned_sender_slot_is_ignored() {
    let sender = Arc::new(Mutex::new(None::<oneshot::Sender<()>>));
    let _ = std::panic::catch_unwind({
        let sender = Arc::clone(&sender);
        move || {
            let _guard = sender.lock().unwrap();
            panic!("poison the slot");
        }
    });
    notify_window_destroyed(&WindowEvent::Destroyed, &sender);
}

#[tokio::test]
async fn destruction_is_acknowledged_only_by_the_window_event() {
    let (tx, rx) = oneshot::channel();
    tx.send(()).unwrap();
    assert!(destruction_acknowledged(rx, Duration::from_secs(1)).await);

    let (tx, rx) = oneshot::channel::<()>();
    drop(tx);
    assert!(!destruction_acknowledged(rx, Duration::from_secs(1)).await);

    let (_tx, rx) = oneshot::channel::<()>();
    assert!(!destruction_acknowledged(rx, Duration::from_millis(5)).await);
}

#[test]
fn window_failures_are_reported_without_panicking() {
    assert!(destroy_requested(Ok(())));
    assert!(!destroy_requested(Err(tauri::Error::WindowNotFound)));
    report_close_failure(Ok(()));
    report_close_failure(Err(tauri::Error::WindowNotFound));
}
