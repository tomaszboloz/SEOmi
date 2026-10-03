use super::*;

#[test]
fn formatter_keeps_valid_events_and_suppresses_untrusted_framework_text() {
    let expected = event("warn", "ipc_dispatched", Uuid::new_v4(), "get_config");
    let json = serde_json::to_string(&expected).unwrap();
    let formatted = format_record(
        &log::Record::builder()
            .target("seomi::event")
            .args(format_args!("{json}"))
            .build(),
    );
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&formatted).unwrap(),
        serde_json::to_value(expected).unwrap()
    );
    for target in ["reqwest", "seomi::event"] {
        let formatted = format_record(
            &log::Record::builder()
                .target(target)
                .level(log::Level::Error)
                .args(format_args!(
                    "token=secret /Users/person/private https://user:pass@example.com"
                ))
                .build(),
        );
        let value: serde_json::Value = serde_json::from_str(&formatted).unwrap();
        assert_eq!(value["event"], "framework_diagnostic");
        assert_eq!(value["level"], "error");
        assert!(
            !formatted.contains("secret")
                && !formatted.contains("/Users/")
                && !formatted.contains("example.com")
        );
    }
}
