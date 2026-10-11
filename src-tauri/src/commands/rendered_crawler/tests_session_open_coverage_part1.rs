use super::*;

#[test]
fn test_session_navigation_unhit_branches() {
    let nonce = "test-cov-nonce";
    let (tx, mut rx) = mpsc::channel(10);
    let allowed = vec!["sub.example.test".to_string()];

    // capture_event_for_navigation tests
    let ok_chunk = Url::parse(&format!("seomi-capture://{nonce}/1/0/1?data=ok")).unwrap();
    assert!(matches!(
        capture_event_for_navigation(&ok_chunk, nonce),
        Some(CaptureEvent::Chunk(_))
    ));
    let fail_ev = Url::parse(&format!("seomi-capture://{nonce}/1/error")).unwrap();
    assert!(matches!(
        capture_event_for_navigation(&fail_ev, nonce),
        Some(CaptureEvent::TransferFailed(1))
    ));
    let bad_nonce = Url::parse("seomi-capture://wrong/1/0/1?data=ok").unwrap();
    assert!(capture_event_for_navigation(&bad_nonce, nonce).is_none());

    // seomi-capture scheme with bad nonce -> capture_event_for_navigation returns None
    assert!(!handle_session_navigation(
        &bad_nonce,
        nonce,
        &tx,
        "example.test",
        false,
        None,
        &allowed
    ));
    assert!(rx.try_recv().is_err());

    // seomi-capture scheme with malformed path
    let bad_path = Url::parse(&format!("seomi-capture://{nonce}/invalid/path")).unwrap();
    assert!(!handle_session_navigation(
        &bad_path,
        nonce,
        &tx,
        "example.test",
        false,
        None,
        &allowed
    ));
    assert!(rx.try_recv().is_err());

    // Valid chunk with dropped receiver
    drop(rx);
    assert!(!handle_session_navigation(
        &ok_chunk,
        nonce,
        &tx,
        "example.test",
        false,
        None,
        &allowed
    ));
}

#[test]
fn test_session_page_load_unhit_branches() {
    let (tx, rx) = mpsc::channel(10);
    let seq = AtomicU64::new(0);
    let options = RenderOptions::default();
    let url = Url::parse("https://example.test/landing").unwrap();
    let mut eval_count = 0;

    // Branch 1: window_url is None
    handle_session_page_load(
        PageLoadEvent::Finished,
        (None, &url),
        &seq,
        &tx,
        "n",
        &options,
        |_| eval_count += 1,
    );
    assert_eq!(eval_count, 0);

    // Branch 2: event is not Finished
    handle_session_page_load(
        PageLoadEvent::Started,
        (Some(&url), &url),
        &seq,
        &tx,
        "n",
        &options,
        |_| eval_count += 1,
    );
    assert_eq!(eval_count, 0);

    // Branch 3: sender fails because receiver is dropped
    drop(rx);
    handle_session_page_load(
        PageLoadEvent::Finished,
        (Some(&url), &url),
        &seq,
        &tx,
        "n",
        &options,
        |_| eval_count += 1,
    );
    assert_eq!(eval_count, 0);

    // Success path
    let (tx2, mut rx2) = mpsc::channel(10);
    handle_session_page_load(
        PageLoadEvent::Finished,
        (Some(&url), &url),
        &seq,
        &tx2,
        "n",
        &options,
        |_| eval_count += 1,
    );
    assert_eq!(eval_count, 1);
    assert!(matches!(rx2.try_recv(), Ok(CaptureEvent::PageReady(_))));
}
