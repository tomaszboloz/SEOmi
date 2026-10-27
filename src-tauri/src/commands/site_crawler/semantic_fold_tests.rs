use super::{fold_semantic_text, semantic_noise_token};

#[test]
fn noise_tokens_include_words_whose_digits_match_or_outnumber_letters() {
    assert!(semantic_noise_token("ab12"));
    assert!(semantic_noise_token("abc123"));
    assert!(!semantic_noise_token("b2b"));
    assert!(!semantic_noise_token("abc12"));
}

#[test]
fn folding_maps_stroked_and_ligature_letters_to_ascii() {
    assert_eq!(fold_semantic_text("Đurđevac Ħal Ŧest"), "durdevac hal test");
    assert_eq!(
        fold_semantic_text("Łódź Straße Ørsted Æble Œuvre"),
        "lodz strasse orsted aeble oeuvre"
    );
}
