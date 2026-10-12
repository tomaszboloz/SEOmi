#[test]
fn connect_failures_are_prefixed_with_the_attempted_step() {
    use super::connect_errors::{failed, text};
    let io = std::io::Error::other("busy");
    assert_eq!(failed("Bind")(io), "Bind: busy");
    let http = reqwest::Client::builder()
        .user_agent("bad\nagent")
        .build()
        .unwrap_err();
    assert!(failed("Client")(http).starts_with("Client: "));
    assert_eq!(
        text(url::Url::parse("http://[").unwrap_err()),
        "invalid IPv6 address"
    );
}
