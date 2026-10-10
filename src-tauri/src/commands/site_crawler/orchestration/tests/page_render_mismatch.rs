use super::page_fixture::*;
use super::page_render_status::assembled;
use super::*;

#[tokio::test]
async fn mismatched_render_url_keeps_http_status_but_marks_header_verdict_uncertain() {
    let mut state = state();
    let mut page_data = data(HTML);
    page_data.x_robots_tag = Some("noindex".into());
    page_data.response_headers_available = false;
    page_data.response_url_mismatch = true;
    assembled(page_data, &mut state).await;
    let page = &state.pages[0];
    assert_eq!(page.http_status, 200);
    assert_eq!(
        page.indexability_verdict.as_ref().unwrap().status,
        "uncertain"
    );
    assert!(!page
        .indexability_verdict
        .as_ref()
        .unwrap()
        .reasons
        .contains(&"robots_noindex".to_string()));
    assert!(page
        .issues
        .iter()
        .any(|issue| issue.message.contains("different URL")));
}
