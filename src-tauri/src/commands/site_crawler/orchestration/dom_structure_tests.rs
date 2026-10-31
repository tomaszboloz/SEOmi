use super::{attach, measure};
use crate::commands::site_crawler::models::{CrawledPageFocus, DomStructure};
use scraper::Html;

#[test]
fn counts_main_content_structure_and_skips_chrome() {
    let html = Html::parse_document(
        r#"<html><body>
        <nav><ul><li>a</li></ul><form><input name="q"></form></nav>
        <header><table></table></header>
        <div role="contentinfo"><ol><li>x</li></ol></div>
        <main>
          <table><tr><td>1</td></tr></table><table></table>
          <ol><li>step</li></ol><ul><li>a</li><li><ul><li>nested</li></ul></li></ul>
          <form><input type="text"><input type="HIDDEN"><input type="submit"><input type="checkbox">
            <select><option>a</option></select><textarea></textarea></form>
          <input type="text">
        </main>
        <aside><table></table></aside><footer><ul></ul></footer>
        </body></html>"#,
    );
    assert_eq!(
        measure(&html),
        DomStructure {
            tables: 2,
            ordered_lists: 1,
            unordered_lists: 2,
            interactive_inputs: 4,
        }
    );
}

#[test]
fn attach_records_counts_only_for_complete_html() {
    let html = Html::parse_document("<p>plain</p>");
    let measured = attach(CrawledPageFocus::default(), &html, true);
    assert_eq!(measured.dom_structure, Some(DomStructure::default()));
    let skipped = attach(CrawledPageFocus::default(), &html, false);
    assert_eq!(skipped.dom_structure, None);
    let json = serde_json::to_value(&skipped).unwrap();
    assert!(
        json.get("dom_structure").is_none(),
        "absent stays absent on the wire"
    );
    let legacy: CrawledPageFocus = serde_json::from_str("{}").unwrap();
    assert_eq!(legacy.dom_structure, None, "older runs still load");
}
