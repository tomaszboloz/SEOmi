use super::super::headings::{append_heading_node, build_heading_tree, parse_headings};

#[test]
fn skipped_heading_levels_keep_text_and_report_the_exact_transition() {
    let (structure, issues) = parse_headings(
        "<h1>Topic</h1><h3>Skipped <em>section</em></h3><h4>Detail</h4><h5>More</h5><h6>Last</h6>",
    );
    assert!(!structure.has_valid_hierarchy);
    assert_eq!(structure.h1_texts, ["Topic"]);
    let skipped = issues
        .iter()
        .find(|issue| issue.code.as_deref() == Some("headings_hierarchy_skip"))
        .unwrap();
    let params = skipped.params.as_ref().unwrap();
    assert_eq!(params.get("previous").map(String::as_str), Some("1"));
    assert_eq!(params.get("level").map(String::as_str), Some("3"));
    assert_eq!(
        params.get("text").map(String::as_str),
        Some("Skipped  section")
    );
    assert_eq!(structure.issues.len(), 1);
    assert_eq!(structure.hierarchy[0].children[0].level, 3);
    assert_eq!(structure.hierarchy[0].children[0].children[0].level, 4);
}

#[test]
fn heading_tree_preserves_siblings_and_return_to_a_parent() {
    let mut roots = build_heading_tree(&[
        (1, "Topic".into()),
        (2, "First".into()),
        (3, "Detail".into()),
        (2, "Second".into()),
    ]);
    assert_eq!(roots.len(), 1);
    assert_eq!(roots[0].children.len(), 2);
    assert_eq!(roots[0].children[0].children[0].text, "Detail");
    assert_eq!(roots[0].children[1].text, "Second");
    append_heading_node(&mut roots, 1, "Other topic");
    assert_eq!(roots.len(), 2);
    assert_eq!(roots[1].text, "Other topic");
    assert!(roots[1].children.is_empty());
}
