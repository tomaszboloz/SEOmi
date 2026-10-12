use super::semantic_style_hides;

#[test]
fn declarations_without_a_colon_never_hide_content() {
    assert!(!semantic_style_hides("display"));
    assert!(!semantic_style_hides("color red; display"));
    assert!(semantic_style_hides("color red; display: none"));
}
