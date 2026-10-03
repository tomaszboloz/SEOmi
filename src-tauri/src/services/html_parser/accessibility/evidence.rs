use super::*;

pub(in crate::services::html_parser) fn accessibility_element_evidence(
    element: &ElementRef<'_>,
    dom_position: usize,
    selector: &str,
    source: &str,
) -> AccessibilityElementEvidence {
    let (line, column) = element_source_offset(source, dom_position, element, selector)
        .map_or((None, None), |offset| source_line_column(source, offset));
    AccessibilityElementEvidence {
        dom_position,
        dom_query: accessibility_dom_query(selector, dom_position - 1),
        html_snippet: accessibility_element_snippet(element),
        line,
        column,
    }
}

pub(in crate::services::html_parser) fn accessibility_dom_query(
    selector: &str,
    index: usize,
) -> String {
    if selector.contains('\'') {
        format!(
            "document.querySelectorAll(\"{}\")[{index}]",
            selector.replace('"', "\\\"")
        )
    } else {
        format!("document.querySelectorAll('{selector}')[{index}]")
    }
}

pub(in crate::services::html_parser) fn accessibility_control_evidence(
    control: &ElementRef<'_>,
    dom_position: usize,
    source: &str,
) -> AccessibilityElementEvidence {
    let selector_index = dom_position - 1;
    let (line, column) = form_control_source_offset(source, dom_position)
        .map_or((None, None), |offset| source_line_column(source, offset));
    AccessibilityElementEvidence {
        dom_position,
        dom_query: format!(
            "document.querySelectorAll('input, select, textarea')[{selector_index}]"
        ),
        html_snippet: accessibility_control_snippet(control),
        line,
        column,
    }
}
