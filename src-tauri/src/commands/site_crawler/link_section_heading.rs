use scraper::ElementRef;

/// Nodes inspected while looking for the governing H2/H3; past this the heading stays unknown.
const MAX_HEADING_SCAN_NODES: usize = 1_500;
/// Characters kept from a section heading.
const MAX_HEADING_CHARS: usize = 160;

fn is_section_heading(element: &ElementRef<'_>) -> bool {
    matches!(element.value().name(), "h2" | "h3")
}

fn heading_text(element: &ElementRef<'_>) -> Option<String> {
    let text = element
        .text()
        .flat_map(str::split_whitespace)
        .collect::<Vec<_>>()
        .join(" ");
    (!text.is_empty()).then(|| text.chars().take(MAX_HEADING_CHARS).collect())
}

/// Nearest H2/H3 before the anchor in document order (issue #70), bounded by a node budget.
pub(crate) fn section_heading(element: &ElementRef<'_>) -> Option<String> {
    let mut budget = MAX_HEADING_SCAN_NODES;
    let mut current = **element;
    loop {
        for sibling in current.prev_siblings() {
            let mut last = None;
            for node in sibling.descendants() {
                budget = budget.checked_sub(1)?;
                if let Some(candidate) = ElementRef::wrap(node).filter(is_section_heading) {
                    last = Some(candidate);
                }
            }
            if let Some(heading) = last {
                return heading_text(&heading);
            }
        }
        current = current.parent()?;
    }
}
