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
    let process = super::tests::fixture_process("printf '\\000\\nvisible diagnostic\\n'", "[Console]::Out.Write([char]0); [Console]::Out.WriteLine(); [Console]::Out.WriteLine('visible diagnostic')");
    let output =
        super::tests::collect_fixture_output(process, "", std::time::Duration::from_secs(10))
            .await
            .unwrap();
    assert_eq!(super::display_output(&output), "visible diagnostic");
}
