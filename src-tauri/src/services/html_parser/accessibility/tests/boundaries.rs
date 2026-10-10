use super::*;

#[test]
fn attributes_and_locations_handle_truncated_tags_and_trailing_whitespace() {
    assert_eq!(
        source_attribute_value("<input name=   ", "name"),
        Some(String::new())
    );
    assert_eq!(
        source_attribute_value("<input name='unfinished", "name"),
        Some("unfinished".into())
    );
    assert_eq!(
        source_attribute_value("<input name='ok'> name='outside'", "name"),
        Some("ok".into())
    );
    let document = Html::parse_document("<input id='x'>");
    let selector = Selector::parse("[id]").unwrap();
    let element = document.select(&selector).next().unwrap();
    assert_eq!(
        element_source_offset("<input id='x'", 1, &element, "[id]"),
        None
    );
}

#[test]
fn source_attribute_reader_handles_empty_input_and_unquoted_tag_endings() {
    assert_eq!(source_attribute_value("", "name"), None);
    assert_eq!(source_attribute_value("<input", "name"), None);
    assert_eq!(source_attribute_value("<input   ", "name"), None);
    assert_eq!(
        source_attribute_value("<input name=>", "name"),
        Some(String::new())
    );
    assert_eq!(
        source_attribute_value("<input name=x>", "name"),
        Some("x".into())
    );
    assert_eq!(
        source_attribute_value("<input name=x", "name"),
        Some("x".into())
    );
}

#[test]
fn wrapped_labels_and_named_interactions_are_resolved_without_fabricated_names() {
    let source = "<label>Wrapped<input id='one'></label><label> <input id='two'></label><span id='name'>Go</span><button aria-labelledby='name'></button><button aria-labelledby='absent'></button><input type='submit' value='Go'><button title='Go'></button>";
    let document = Html::parse_document(source);
    let (_, labels) = document_metadata(&document);
    let identity = identity_inventory(&document);
    let controls = control_inventory(&document, source, &labels, &identity.nonempty_id_names);
    assert_eq!(controls.form_control_count, 3);
    assert_eq!(controls.unlabeled_form_control_count, 2);
    let mut codes = Vec::new();
    let unnamed = interactive_elements(
        &document,
        source,
        &identity.nonempty_id_names,
        &mut |code, _, _, _, _| codes.push(code.to_string()),
    );
    assert_eq!(unnamed.len(), 1);
    assert!(unnamed[0].html_snippet.contains("absent"));
    assert_eq!(codes, vec!["accessibility-interactive-name-missing"]);
}

#[test]
fn role_landmarks_and_hidden_ancestor_contracts_keep_visible_controls_distinct() {
    let document = Html::parse_document("<div role='navigation'></div><div role='other'></div><div style='display:none'><input name='website'></div><input name='url' tabindex='-1'><input name='website'>");
    let identity = identity_inventory(&document);
    assert_eq!(identity.landmark_counts.get("navigation"), Some(&1));
    assert!(!identity.landmark_counts.contains_key("other"));
    let selector = Selector::parse("input").unwrap();
    let inputs = document.select(&selector).collect::<Vec<_>>();
    assert!(is_hidden_conventional_anti_spam_field(&inputs[0]));
    assert!(is_hidden_conventional_anti_spam_field(&inputs[1]));
    assert!(!is_hidden_conventional_anti_spam_field(&inputs[2]));
}

#[test]
fn snippets_are_bounded_by_unicode_characters_and_mark_truncation() {
    let source = format!("<input placeholder='{}' value='secret'>", "ą".repeat(400));
    let document = Html::parse_document(&source);
    let selector = Selector::parse("input").unwrap();
    let snippet = accessibility_element_snippet(&document.select(&selector).next().unwrap());
    assert_eq!(snippet.chars().count(), 321);
    assert!(snippet.ends_with('…'));
    assert!(!snippet.contains("secret"));
}

#[test]
fn explicit_names_populate_identity_and_control_inventories() {
    let source = "<input id='aria' aria-label='Name'><span id='title' title='Title'></span><input id='empty' aria-label=' '>";
    let document = Html::parse_document(source);
    let identity = identity_inventory(&document);
    assert!(identity.nonempty_id_names.contains("aria"));
    assert!(identity.nonempty_id_names.contains("title"));
    assert!(!identity.nonempty_id_names.contains("empty"));
    let (_, labels) = document_metadata(&document);
    let controls = control_inventory(&document, source, &labels, &identity.nonempty_id_names);
    assert_eq!(controls.form_control_count, 2);
    assert_eq!(controls.unlabeled_form_control_count, 1);
    assert!(controls.unlabeled_form_controls[0]
        .html_snippet
        .contains("empty"));
}
