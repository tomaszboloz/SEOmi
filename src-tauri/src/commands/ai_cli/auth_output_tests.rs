use super::authenticated_output;

#[test]
fn negative_authentication_words_are_not_positive_evidence() {
    for text in [
        "Unauthenticated",
        "Status: unauthenticated",
        "Authenticated: false",
        "authenticated=false",
    ] {
        assert!(!authenticated_output("openai", text), "{text}");
    }
}

#[tokio::test]
async fn invisible_first_line_does_not_hide_the_next_diagnostic() {
    let output = super::tests::binary_fixture::collect_bytes_output(
        b"\0\nvisible diagnostic\n",
        std::time::Duration::from_secs(10),
    )
    .await;
    assert_eq!(super::display_output(&output), "visible diagnostic");
}
