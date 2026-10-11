use super::super::accessibility::{control_inventory, document_metadata, identity_inventory};
use scraper::Html;

#[test]
fn control_evidence_samples_are_capped_while_counts_remain_complete() {
    let mut source = String::from("<main>");
    for _ in 0..51 {
        source.push_str("<input type='hidden' name='website'>");
    }
    for _ in 0..51 {
        source.push_str("<input type='text' class='contact-honeytrap'>");
    }
    source.push_str("</main>");

    let document = Html::parse_document(&source);
    let (_, labels_for) = document_metadata(&document);
    let identity = identity_inventory(&document);
    let inventory = control_inventory(&document, &source, &labels_for, &identity.nonempty_id_names);

    assert_eq!(inventory.form_control_count, 0);
    assert_eq!(inventory.unlabeled_form_control_count, 0);
    assert_eq!(inventory.hidden_form_control_count, 51);
    assert_eq!(inventory.hidden_form_controls.len(), 50);
    assert_eq!(inventory.anti_spam_non_text_control_count, 51);
    assert_eq!(inventory.anti_spam_non_text_controls.len(), 50);
    assert_eq!(inventory.anti_spam_text_control_count, 51);
    assert_eq!(inventory.anti_spam_text_controls.len(), 50);
}
