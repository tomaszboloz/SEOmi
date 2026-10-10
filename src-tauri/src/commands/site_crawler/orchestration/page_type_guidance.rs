use scraper::Html;

use super::super::models::CrawledPageIssue;
use super::page_type_evidence::{has_application_shell, is_listing};
use super::page_type_frames::iframe_only;

const THIN_TEXT_WORDS: usize = 50;
const APP_SHELL_WORDS: usize = 8;

pub(super) fn thin_content_issue(
    document: &Html,
    page_url: &str,
    crawl_mode: &str,
    status: u16,
    complete_html: bool,
    word_count: usize,
) -> Option<CrawledPageIssue> {
    if !complete_html || word_count >= THIN_TEXT_WORDS {
        return None;
    }
    if let Some(frame_count) = iframe_only(document) {
        return Some(info(format!(
            "The HTML is an iframe-only wrapper ({frame_count} iframe(s)); audit the embedded document separately because the wrapper has no crawlable text."
        )));
    }
    if crawl_mode == "http"
        && (200..400).contains(&status)
        && word_count <= APP_SHELL_WORDS
        && has_application_shell(document)
    {
        return Some(info(format!(
            "Little or no text was present in the HTTP HTML response ({word_count} words); an application root and JavaScript bundle were observed. Run browser-rendered mode before deciding that content is missing."
        )));
    }
    if is_listing(document, page_url) {
        return Some(info(format!(
            "Listing or archive page has {word_count} words; low text is expected when pagination and internal links provide navigation evidence."
        )));
    }
    Some(info(format!("Thin text content: {word_count} words")))
}

fn info(message: String) -> CrawledPageIssue {
    CrawledPageIssue {
        severity: "Info".into(),
        message,
    }
}
