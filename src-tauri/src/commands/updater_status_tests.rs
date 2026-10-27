#[test]
fn update_status_debug_and_serialization() {
    let status = super::no_update();
    assert!(format!("{status:?}").contains("UpdateStatus"));
    let val = serde_json::to_value(&status).unwrap();
    assert_eq!(val["available"], false);
    assert_eq!(val["current_version"], env!("CARGO_PKG_VERSION"));
}
