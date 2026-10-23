use super::super::audit_csp;

fn findings(policy: &str) -> (u8, Vec<String>) {
    let mut score = 100;
    let mut issues = Vec::new();
    audit_csp(Some(policy), &mut score, &mut issues);
    (score, issues.into_iter().map(|issue| issue.message).collect())
}

#[test]
fn default_src_strict_dynamic_restricts_scripts_when_script_src_is_absent() {
    for trusted in [
        "'nonce-dGVzdC1ub25jZQ=='",
        "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
    ] {
        let policy = format!(
            "default-src * data: 'unsafe-inline' 'unsafe-eval' {trusted} 'strict-dynamic'"
        );
        let (score, messages) = findings(&policy);
        assert_eq!(score, 90, "{policy}: {messages:?}");
        assert_eq!(
            messages,
            ["Content-Security-Policy allows 'unsafe-eval'"],
            "eval remains independent of nonce trust"
        );
    }
}

#[test]
fn script_src_does_not_inherit_strict_dynamic_from_default_src() {
    // Check both directive orders: the fallback is selected by scope, not order.
    for policy in [
        "default-src 'nonce-dGVzdA==' 'strict-dynamic'; script-src * data: 'nonce-dGVzdA=='",
        "script-src * data: 'nonce-dGVzdA=='; default-src 'nonce-dGVzdA==' 'strict-dynamic'",
    ] {
        let (score, messages) = findings(policy);
        assert_eq!(score, 80, "{policy}: {messages:?}");
        assert_eq!(messages.len(), 2);
        assert!(messages[0].contains("wildcard script source"));
        assert!(messages[1].contains("data: script sources"));
    }
}

#[test]
fn script_element_scope_does_not_inherit_default_strict_dynamic() {
    let (score, messages) = findings(
        "default-src 'nonce-dGVzdA==' 'strict-dynamic'; script-src-elem * data: 'nonce-dGVzdA=='",
    );
    assert_eq!(score, 80);
    assert_eq!(messages.len(), 2);
    assert!(messages[0].contains("wildcard script source"));
    assert!(messages[1].contains("data: script sources"));
}

#[test]
fn duplicate_default_src_cannot_replace_the_first_script_fallback() {
    let strict = "default-src * data: 'nonce-dGVzdA==' 'strict-dynamic'";
    assert_eq!(findings(&format!("{strict}; default-src * data:")), (100, vec![]));
    let (score, messages) = findings(&format!("default-src * data:; {strict}"));
    assert_eq!(score, 80);
    assert_eq!(messages.len(), 2);
}
