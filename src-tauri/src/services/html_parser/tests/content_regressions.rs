use super::*;
use crate::services::html_parser::content::*;

#[test]
fn reading_time_rounds_up_at_every_two_hundred_word_boundary() {
    for (count, expected) in [
        (0, 0),
        (1, 1),
        (200, 1),
        (201, 2),
        (399, 2),
        (400, 2),
        (401, 3),
    ] {
        let source = format!("<main>{}</main>", "token ".repeat(count));
        let document = Html::parse_document(&source);
        let stats = extract_content_stats(&document, source.len(), Some("en"));
        assert_eq!(stats.word_count, count);
        assert_eq!(stats.reading_time_minutes, expected, "words={count}");
    }
}

#[test]
fn declared_language_tags_are_case_insensitive_and_trimmed_for_readability() {
    for locale in ["pl", "es", "fr", "de", "it", "pt", "ru", "en"] {
        let expected = readability_formula(Some(locale), 40, 2, 70);
        let tag = format!(" {}-REGION ", locale.to_uppercase());
        assert_eq!(
            readability_formula(Some(&tag), 40, 2, 70),
            expected,
            "{tag}"
        );
    }
}

#[test]
fn readability_does_not_emit_nonfinite_scores_for_empty_observations() {
    for (words, sentences) in [(0, 0), (0, 1), (1, 0)] {
        assert_eq!(
            readability_formula(Some("pl"), words, sentences, 0),
            (0.0, 0.0, "unavailable")
        );
    }
}

#[test]
fn semantic_roots_inside_chrome_or_hidden_ancestors_do_not_suppress_visible_body_text() {
    for wrapper in [
        "<header>",
        "<div hidden>",
        "<div inert>",
        "<div aria-hidden='true'>",
        "<div style='display:none'>",
    ] {
        let close = if wrapper == "<header>" {
            "</header>"
        } else {
            "</div>"
        };
        let source =
            format!("{wrapper}<main>hiddenword</main>{close}<p>Visible content words.</p>");
        let document = Html::parse_document(&source);
        assert!(!has_semantic_content_root(&document), "{wrapper}");
        let stats = extract_content_stats(&document, source.len(), Some("en"));
        assert_eq!(stats.body_text, "Visible content words.", "{wrapper}");
        assert_eq!(stats.word_count, 3);
    }
}
