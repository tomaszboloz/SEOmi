use super::*;
#[test]
fn identity_and_document_inventory_preserve_counts_names_and_reference_evidence() {
    let source = r#"<html lang="pl"><main id="same">Visible</main><main id="same"></main><nav></nav><input aria-labelledby="same missing"><label for="email">Email</label></html>"#;
    let doc = Html::parse_document(source);
    let (language, labels) = document_metadata(&doc);
    assert_eq!(language.as_deref(), Some("pl"));
    assert!(labels.contains("email"));
    let inventory = identity_inventory(&doc);
    assert_eq!(inventory.duplicate_id_count, 1);
    assert_eq!(inventory.duplicate_ids, vec!["same"]);
    assert_eq!(inventory.unresolved_aria_reference_count, 1);
    assert!(inventory.nonempty_id_names.contains("same"));
    assert_eq!(inventory.landmark_counts.get("main"), Some(&2));
    assert_eq!(inventory.aria_attribute_count, 1);
    let (duplicates, unresolved) =
        identity_elements(&doc, source, &inventory.ids, &inventory.duplicate_id_values);
    assert_eq!(duplicates.len(), 2);
    assert_eq!(unresolved.len(), 1);
    let (html, main) = document_elements(&doc, source);
    assert_eq!(html.len(), 1);
    assert_eq!(main.len(), 2);
    let mut codes = Vec::new();
    document_findings(
        language.as_deref(),
        &inventory.landmark_counts,
        &mut |code, _, _, _, _| codes.push(code.to_string()),
    );
    assert_eq!(codes, vec!["accessibility-multiple-main-landmarks"]);
    codes.clear();
    identity_findings(&inventory, &mut |code, _, _, _, _| {
        codes.push(code.to_string())
    });
    assert_eq!(
        codes,
        vec![
            "accessibility-duplicate-id",
            "accessibility-aria-reference-unresolved"
        ]
    );
}
#[test]
fn control_inventory_separates_hidden_antispam_and_unlabeled_inputs() {
    let source = r#"<main><input name="email"><label for="named">Name</label><input id="named"><input type="hidden" name="honeypot"><input type="text" name="website" hidden></main>"#;
    let doc = Html::parse_document(source);
    let (_, labels) = document_metadata(&doc);
    let identity = identity_inventory(&doc);
    let controls = control_inventory(&doc, source, &labels, &identity.nonempty_id_names);
    assert_eq!(controls.form_control_count, 2);
    assert_eq!(controls.unlabeled_form_control_count, 1);
    assert_eq!(controls.hidden_form_control_count, 1);
    assert_eq!(controls.anti_spam_non_text_control_count, 1);
    assert_eq!(controls.anti_spam_text_control_count, 1);
    assert_eq!(controls.unlabeled_form_controls.len(), 1);
    assert_eq!(controls.hidden_form_controls.len(), 1);
    let mut codes = Vec::new();
    control_findings(&controls, &mut |code, _, _, _, _| {
        codes.push(code.to_string())
    });
    assert_eq!(
        codes,
        vec![
            "accessibility-antispam-control-not-text",
            "accessibility-form-controls-unlabeled"
        ]
    );
    let audit = extract_accessibility(&doc, source);
    assert_eq!(audit.form_control_count, 2);
    assert_eq!(audit.manual_review_items.len(), 3);
    assert_eq!(
        audit
            .findings
            .iter()
            .find(|f| f.code == "accessibility-form-controls-unlabeled")
            .unwrap()
            .elements
            .len(),
        1
    );
}
#[test]
fn bounded_inventories_keep_total_counts_and_limit_samples() {
    let source = format!(
        "<main>{}</main>",
        (0..100)
            .map(|_| "<input id='same' aria-controls='missing'>")
            .collect::<String>()
    );
    let doc = Html::parse_document(&source);
    let (_, labels) = document_metadata(&doc);
    let identity = identity_inventory(&doc);
    assert_eq!(identity.duplicate_id_count, 99);
    assert_eq!(identity.duplicate_ids.len(), 1);
    assert_eq!(identity.unresolved_aria_reference_count, 100);
    assert_eq!(identity.unresolved_aria_references.len(), 10);
    let controls = control_inventory(&doc, &source, &labels, &identity.nonempty_id_names);
    assert_eq!(controls.unlabeled_form_control_count, 100);
    assert_eq!(controls.unlabeled_form_controls.len(), 50);
    let (duplicates, unresolved) =
        identity_elements(&doc, &source, &identity.ids, &identity.duplicate_id_values);
    assert_eq!(duplicates.len(), 50);
    assert_eq!(unresolved.len(), 50);
}
