use super::*;

#[test]
fn appending_to_a_run_without_actual_text_keeps_it_unset() {
    let mut fonts = FontSet::new();
    let mut runs = vec![EncodedRun {
        kind: FontKind::Latin,
        hex: String::new(),
        actual_text: None,
    }];
    fonts.append_encoded(&mut runs, FontKind::Latin, 7, "x".into(), 500, "x");
    assert_eq!(runs.len(), 1);
    assert_eq!(runs[0].hex, "0007");
    assert!(runs[0].actual_text.is_none());
}
