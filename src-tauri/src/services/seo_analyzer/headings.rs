use crate::models::audit_data::{
    HeadingNode, HeadingsStructure, Issue, IssueCategory, IssueSeverity,
};
use scraper::{Html, Selector};

pub(super) fn parse_headings(html_str: &str) -> (HeadingsStructure, Vec<Issue>) {
    let document = Html::parse_document(html_str);
    let mut issues = Vec::new();
    let mut h1_texts = Vec::new();
    let mut flat_headings: Vec<(u8, String)> = Vec::new();

    let heading_selector = Selector::parse("h1, h2, h3, h4, h5, h6").unwrap();
    for el in document.select(&heading_selector) {
        let tag = el.value().name();
        let level = match tag {
            "h1" => 1,
            "h2" => 2,
            "h3" => 3,
            "h4" => 4,
            "h5" => 5,
            "h6" => 6,
            _ => 1,
        };

        let text = el.text().collect::<Vec<_>>().join(" ").trim().to_string();
        if level == 1 {
            h1_texts.push(text.clone());
        }
        flat_headings.push((level, text));
    }

    let h1_count = h1_texts.len();
    let mut struct_issues = Vec::new();

    if h1_count == 0 {
        let msg = "No H1 heading found on page".to_string();
        struct_issues.push(msg.clone());
        issues.push(Issue {
            severity: IssueSeverity::Critical,
            category: IssueCategory::Headings,
            code: Some("headings_h1_missing".into()),
            params: None,
            message: msg,
            recommendation: Some(
                "Add exactly one relevant H1 heading defining the primary page topic".to_string(),
            ),
        });
    } else if h1_count > 1 {
        let msg = format!("Multiple H1 headings found ({} total)", h1_count);
        struct_issues.push(msg.clone());
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Headings,
            code: Some("headings_h1_multiple".into()),
            params: Some(std::collections::BTreeMap::from([(
                "count".into(),
                h1_count.to_string(),
            )])),
            message: msg,
            recommendation: Some(
                "Ensure the page has only one primary H1 for optimal SEO semantics".to_string(),
            ),
        });
    }

    // Validate hierarchy level jumps
    let mut has_valid_hierarchy = true;
    let mut prev_level: Option<u8> = None;

    for (lvl, txt) in &flat_headings {
        if let Some(prev) = prev_level {
            if *lvl > prev + 1 {
                has_valid_hierarchy = false;
                let msg = format!(
                    "Skipped heading level: H{} followed directly by H{} ('{}')",
                    prev, lvl, txt
                );
                struct_issues.push(msg.clone());
                issues.push(Issue {
                    severity: IssueSeverity::Warning,
                    category: IssueCategory::Headings,
                    code: Some("headings_hierarchy_skip".into()),
                    params: Some(std::collections::BTreeMap::from([
                        ("previous".into(), prev.to_string()),
                        ("level".into(), lvl.to_string()),
                        ("text".into(), txt.clone()),
                    ])),
                    message: msg,
                    recommendation: Some("Maintain sequential heading hierarchy without skipping levels for accessibility and SEO".to_string()),
                });
            }
        }
        prev_level = Some(*lvl);
    }

    let hierarchy = build_heading_tree(&flat_headings);

    let structure = HeadingsStructure {
        h1_count,
        h1_texts,
        hierarchy,
        has_valid_hierarchy,
        issues: struct_issues,
    };

    (structure, issues)
}

pub(super) fn build_heading_tree(flat: &[(u8, String)]) -> Vec<HeadingNode> {
    let mut roots: Vec<HeadingNode> = Vec::new();
    for (lvl, txt) in flat {
        append_heading_node(&mut roots, *lvl, txt);
    }
    roots
}

pub(super) fn append_heading_node(nodes: &mut Vec<HeadingNode>, level: u8, text: &str) {
    if let Some(last) = nodes.last_mut() {
        if last.level < level {
            append_heading_node(&mut last.children, level, text);
            return;
        }
    }
    nodes.push(HeadingNode {
        level,
        text: text.to_string(),
        children: Vec::new(),
    });
}
