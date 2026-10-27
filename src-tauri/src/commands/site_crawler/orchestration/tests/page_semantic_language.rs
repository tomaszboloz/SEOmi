use super::super::super::models::CrawledPageSummary;
use super::page_fixture::*;
use super::*;

const POLISH: &str = "<html><body><main><p>Szkolenie jest dla zespołów, które się uczą. \
Szkolenia oraz konsultacje dla firm, które mogą rosnąć.</p></main></body></html>";

fn page(status: u16) -> CrawledPageSummary {
    let mut page_data = data(POLISH);
    page_data.status = status;
    let setup = setup(default_crawl_config(None));
    let signals = signals(&page_data, &setup, &mut state(), &mut Vec::new());
    summary(&page_data, signals, Vec::new(), "http")
}

#[test]
fn summary_reports_the_grouping_language_without_inventing_a_document_language() {
    let page = page(200);
    assert_eq!(page.semantic_language.as_deref(), Some("pl"));
    assert!(page.document_language.is_none());
    let inflected = |term: &&String| term.starts_with("szkol");
    assert_eq!(page.semantic_terms.iter().filter(inflected).count(), 1);

    // The desktop UI reads this exact key; older stored crawls lack it.
    let mut stored = serde_json::to_value(&page).unwrap();
    assert_eq!(stored["semantic_language"], "pl");
    stored.as_object_mut().unwrap().remove("semantic_language");
    let legacy: CrawledPageSummary = serde_json::from_value(stored).unwrap();
    assert!(legacy.semantic_language.is_none());
}

#[test]
fn redirect_and_error_responses_keep_the_language_but_contribute_no_terms() {
    for status in [301, 404, 503] {
        let page = page(status);
        assert!(page.semantic_terms.is_empty(), "{status}");
        assert_eq!(page.semantic_language.as_deref(), Some("pl"), "{status}");
    }
}
