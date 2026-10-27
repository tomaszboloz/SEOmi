use super::extract_content_sections;
use crate::commands::site_crawler::models::ContentSection;
use scraper::Html;

fn sections(html: &str) -> Vec<ContentSection> {
    extract_content_sections(&Html::parse_document(html))
}

const LONG: &str = "one two three four five six seven eight nine ten";

#[test]
fn splits_main_content_at_headings_and_counts_blocks() {
    let html = format!(
        "<html><body><nav>menu menu menu menu menu menu menu menu menu</nav><main>\
         <p>{LONG} intro</p><h2>Alpha topic</h2><p>{LONG}</p><table><tr><td>1</td></tr></table>\
         <ul><li>x</li></ul><h3>Beta</h3><p>{LONG}</p><script>var a = 1 2 3 4 5 6 7 8 9 10;</script></main>\
         <footer>footer footer footer footer footer footer footer footer</footer></body></html>"
    );
    let result = sections(&html);
    let names: Vec<_> = result.iter().map(|s| (s.heading.as_str(), s.level)).collect();
    assert_eq!(names, vec![("", 0), ("Alpha topic", 2), ("Beta", 3)]);
    assert_eq!((result[1].tables, result[1].lists), (1, 1));
    assert!(result.iter().all(|s| !s.text.contains("menu") && !s.text.contains("footer") && !s.text.contains("var")));
    assert!(!result[1].text.contains("Alpha"));
}

#[test]
fn drops_short_blocks_and_caps_text_and_count() {
    let long_text = "word ".repeat(600);
    let html = format!("<html><body><h2>Short</h2><p>tiny</p><h2>Long</h2><p>{long_text}</p></body></html>");
    let result = sections(&html);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].heading, "Long");
    assert_eq!(result[0].words, 600);
    assert!(result[0].text.chars().count() <= 1000);

    let many: String = (0..40).map(|i| format!("<h2>Part {i}</h2><p>{LONG}</p>")).collect();
    assert_eq!(sections(&format!("<html><body>{many}</body></html>")).len(), 24);
    assert!(sections("<html></html>").is_empty());
}
