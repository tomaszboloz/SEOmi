use super::xpath::xpath_to_css;

#[test]
fn double_quoted_predicates_are_translated() {
    assert!(xpath_to_css(r#"//a[@title="x/y"]"#).is_ok());
}

#[test]
fn slash_inside_unquoted_brackets_does_not_split_the_step() {
    assert!(xpath_to_css("//a[b/c]").is_err());
}

#[test]
fn blank_step_between_slashes_is_rejected() {
    let error = xpath_to_css("/ /a").unwrap_err();
    assert!(error.contains("nie jest obsługiwany"));
}
