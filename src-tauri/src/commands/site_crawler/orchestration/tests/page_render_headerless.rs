use super::page_fixture::*;
use super::page_render_status::status_issues;

#[test]
fn a_bare_rendered_snapshot_without_a_status_says_so() {
    let mut page_data = data("");
    page_data.status = 0;
    page_data.rendered_diagnostics = Some((Vec::new(), Vec::new()));
    page_data.response_headers_available = false;
    assert_eq!(
        status_issues(&page_data, CURRENT_URL, 0),
        vec!["Info: Browser did not expose the HTTP status for this rendered response"]
    );
    page_data.response_headers_available = true;
    assert!(status_issues(&page_data, CURRENT_URL, 0).is_empty());
}
