use super::fold_semantic_text;

#[test]
fn folding_maps_stroked_and_ligature_letters_to_ascii() {
    assert_eq!(fold_semantic_text("Đurđevac Ħal Ŧest"), "durdevac hal test");
    assert_eq!(
        fold_semantic_text("Łódź Straße Ørsted Æble Œuvre"),
        "lodz strasse orsted aeble oeuvre"
    );
}
