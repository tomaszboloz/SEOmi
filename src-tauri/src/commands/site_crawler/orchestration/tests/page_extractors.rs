use super::super::page_extra_schema_pagination::extract_page_schema_and_pagination;
use super::super::page_headings::extract_page_headings;
use super::super::page_metadata_canonical::extract_page_canonical;
use super::super::page_title_meta::extract_page_title_and_meta;
use super::page_fixture::*;
use super::*;
use scraper::Html;
use url::Url;

#[test]
fn title_metadata_extractor_requires_usable_html_and_counts_unicode_characters() {
    let document = Html::parse_document(
        "<title>  Żółć  </title><meta name='description' content='  Gęślą  '>",
    );
    let selectors = CrawlSelectors::compile();
    for usable in [true, false] {
        let mut issues = Vec::new();
        let result = extract_page_title_and_meta(
            &document,
            usable,
            &selectors.title,
            &selectors.meta_desc,
            &mut issues,
        );
        assert_eq!(result.title.as_deref(), usable.then_some("Żółć"));
        assert_eq!(result.title_length, usable.then_some(4));
        assert_eq!(
            result.meta_description.as_deref(),
            usable.then_some("Gęślą")
        );
        assert_eq!(result.meta_description_length, usable.then_some(5));
        assert_eq!(issues.len(), if usable { 2 } else { 0 });
    }
}

#[test]
fn headings_extractor_keeps_observed_levels_only_for_usable_html() {
    let document =
        Html::parse_document("<h1>First</h1><h1>Second</h1><h3>Repeated</h3><h3>Repeated</h3>");
    let selectors = CrawlSelectors::compile();
    for usable in [true, false] {
        let mut issues = Vec::new();
        let result = extract_page_headings(
            &document,
            usable,
            &selectors.h1,
            &selectors.headings,
            &mut issues,
        );
        assert_eq!(result.h1_count, if usable { 2 } else { 0 });
        assert_eq!(
            result.heading_counts,
            if usable {
                vec![2, 0, 2, 0, 0, 0]
            } else {
                vec![0; 6]
            }
        );
        assert_eq!(result.duplicate_headings.len(), usize::from(usable));
        assert_eq!(issues.len(), if usable { 2 } else { 0 });
    }
}

#[test]
fn canonical_extractor_does_not_classify_non_html_declarations_as_observed_targets() {
    let document = Html::parse_document("<link rel='canonical' href='/elsewhere'>");
    let base = Url::parse(FINAL_URL).unwrap();
    for usable in [true, false] {
        let mut issues = Vec::new();
        let result = extract_page_canonical(&document, &base, FINAL_URL, usable, 0, 0, &mut issues);
        assert_eq!(
            result.canonical.as_deref(),
            usable.then_some("https://example.test/elsewhere")
        );
        assert_eq!(result.canonical_declaration_count, usize::from(usable));
        assert_eq!(result.canonical_targets.len(), usize::from(usable));
        assert_eq!(result.canonical_points_elsewhere, usable);
        if usable {
            assert!(!result.canonical_targets[0].checked_in_run);
            assert!(result.canonical_targets[0].http_status.is_none());
        } else {
            assert!(issues.is_empty());
        }
    }
}

#[test]
fn schema_pagination_extractor_does_not_invent_targets_from_unusable_html() {
    let document = Html::parse_document(HTML);
    let base = Url::parse(FINAL_URL).unwrap();
    let selectors = CrawlSelectors::compile();
    let result = extract_page_schema_and_pagination(
        &document,
        &base,
        false,
        &selectors.canonical,
        &selectors.hreflang,
        &mut Vec::new(),
    );
    assert!(result.hreflangs.is_empty() && result.pagination_links.is_empty());
    assert!(
        result.amp_url.is_none()
            && result.pagination_next.is_none()
            && result.pagination_prev.is_none()
    );
    assert_eq!(
        (
            result.pagination_declaration_count,
            result.pagination_invalid_declaration_count
        ),
        (0, 0)
    );
    assert!(result.schema_types.is_empty() && result.schema_references.is_empty());
    assert_eq!(result.schema_syntax_errors, 0);
    assert!(!result.schema_validation_truncated);
    let result = extract_page_schema_and_pagination(
        &document,
        &base,
        true,
        &selectors.canonical,
        &selectors.hreflang,
        &mut Vec::new(),
    );
    assert_eq!(result.schema_types, vec!["Article"]);
    assert_eq!(result.pagination_links.len(), 1);
    assert_eq!(result.hreflangs[0].language, "pl");
    assert_eq!(
        result.amp_url.as_deref(),
        Some("https://example.test/article/amp")
    );
}
