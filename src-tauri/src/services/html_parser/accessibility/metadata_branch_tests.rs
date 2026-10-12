use super::*;

#[test]
fn only_labels_with_text_and_a_non_empty_target_are_collected() {
    let document = Html::parse_document(
        r#"<html><body>
        <label for="ok">Name</label>
        <label for="">Empty target</label>
        <label for="   ">Blank target</label>
        <label for="silent">   </label>
        </body></html>"#,
    );
    let (_, labels) = document_metadata(&document);
    assert_eq!(labels, HashSet::from(["ok"]));
}
