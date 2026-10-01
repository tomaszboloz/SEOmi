use super::*;
use crate::models::audit_data::AccessibilityFinding;
use std::collections::HashSet;

#[test]
fn public_parser_combines_independent_document_contracts() {
    let html = r#"<!doctype html><html lang="pl"><head>
    <title>Artykuł testowy</title><meta name="generator" content="WordPress 6.8">
    <link rel="canonical" href="/article"><link rel="icon" href="/icon.png">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Artykuł"}</script>
    </head><body><nav>navigationword</nav><main><h1>Treść artykułu</h1>
    <p>To jest widoczna treść strony z opisem przykładu.</p><span aria-hidden="true">secretword</span>
    <input type="text" name="email" value="must-not-appear-in-evidence"></main></body></html>"#;
    let parsed = parse_html(html, "https://example.com/base/").unwrap();
    assert_eq!(parsed.meta_tags.title.as_deref(), Some("Artykuł testowy"));
    assert_eq!(
        parsed.meta_tags.canonical.as_deref(),
        Some("https://example.com/article")
    );
    assert_eq!(
        parsed.accessibility.document_language.as_deref(),
        Some("pl")
    );
    assert!(parsed.content_stats.body_text.contains("widoczna treść"));
    assert!(!parsed.content_stats.body_text.contains("secretword"));
    assert!(!parsed.content_stats.body_text.contains("navigationword"));
    assert_eq!(parsed.structured_data.len(), 1);
    assert!(!parsed.accessibility.findings.is_empty());
    assert!(!serde_json::to_string(&parsed.accessibility)
        .unwrap()
        .contains("must-not-appear-in-evidence"));
}

const SAMPLE_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Fast SEO Auditor for Developers | SEOmi</title>
    <meta name="description" content="A blazingly fast native desktop SEO tool built with Rust and React.">
    <meta name="keywords" content="seo, desktop, rust, audit">
    <meta name="robots" content="index, follow">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="author" content="SEOmi Team">
    <link rel="canonical" href="https://example.com/seomi">
    <link rel="icon" href="/assets/favicon.ico">
    <link rel="alternate" hreflang="pl" href="/pl/seomi">
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "SEOmi",
      "applicationCategory": "DeveloperApplication"
    }
    </script>
  </head>
  <body>
    <h1>SEOmi Desktop Auditor</h1>
    <p>SEOmi provides comprehensive SEO analysis and performance tracking.</p>
    <p>Audit your links, headings, and security headers with ease.</p>
  </body>
</html>
"#;

#[test]
fn test_title_and_description_extraction() {
    let parsed = parse_html(SAMPLE_HTML, "https://example.com").unwrap();
    assert_eq!(
        parsed.meta_tags.title,
        Some("Fast SEO Auditor for Developers | SEOmi".to_string())
    );
    assert_eq!(parsed.meta_tags.title_length, 39);
    assert_eq!(
        parsed.meta_tags.description,
        Some("A blazingly fast native desktop SEO tool built with Rust and React.".to_string())
    );
    assert!(parsed.meta_tags.description_length > 0);
}

#[test]
fn test_canonical_and_favicon_resolution() {
    let parsed = parse_html(SAMPLE_HTML, "https://example.com").unwrap();
    assert_eq!(
        parsed.meta_tags.canonical,
        Some("https://example.com/seomi".to_string())
    );
    assert_eq!(
        parsed.technical.favicon,
        Some("https://example.com/assets/favicon.ico".to_string())
    );
    assert_eq!(parsed.technical.favicons.len(), 1);
}

#[test]
fn collects_all_declared_favicon_variants_without_fetching_them() {
    let parsed = parse_html(
        "<html><head><link rel=\"icon\" href=\"/favicon.svg\" type=\"image/svg+xml\" sizes=\"any\"><link rel=\"apple-touch-icon\" href=\"/apple.png\" sizes=\"180x180\"></head><body></body></html>",
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.technical.favicons.len(), 2);
    assert!(parsed
        .technical
        .favicons
        .iter()
        .any(|item| item.href == "https://example.com/favicon.svg"
            && item.declared_type.as_deref() == Some("image/svg+xml")
            && item.inferred_format.as_deref() == Some("svg")));
    assert!(parsed
        .technical
        .favicons
        .iter()
        .any(|item| item.rel == "apple-touch-icon"
            && item.declared_sizes.as_deref() == Some("180x180")));
}

#[test]
fn test_hreflang_extraction() {
    let parsed = parse_html(SAMPLE_HTML, "https://example.com").unwrap();
    assert_eq!(parsed.technical.hreflang_tags.len(), 1);
    assert_eq!(parsed.technical.hreflang_tags[0].hreflang, "pl");
    assert_eq!(
        parsed.technical.hreflang_tags[0].href,
        "https://example.com/pl/seomi"
    );
}

#[test]
fn test_json_ld_extraction() {
    let parsed = parse_html(SAMPLE_HTML, "https://example.com").unwrap();
    assert_eq!(parsed.structured_data.len(), 1);
    assert_eq!(parsed.structured_data[0].data_type, "SoftwareApplication");
    assert_eq!(parsed.structured_data[0].format, "JSON-LD");
}

#[test]
fn records_jsonld_syntax_and_supported_schema_profile_findings() {
    let parsed = parse_html(
        r#"<html><head>
          <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","description":"A sample product"}</script>
          <script type="application/ld+json">{"@type":</script>
        </head></html>"#,
        "https://example.com",
    )
    .unwrap();
    assert_eq!(parsed.structured_data.len(), 2);
    assert!(parsed.structured_data[0]
        .validation_issues
        .iter()
        .any(|issue| issue.code == "product-name-missing"));
    assert_eq!(parsed.structured_data[1].data_type, "Invalid JSON-LD block");
    assert!(parsed.structured_data[1]
        .validation_issues
        .iter()
        .any(|issue| issue.code == "jsonld-syntax-invalid"));
}

#[test]
fn reports_microdata_without_itemtype_instead_of_silently_dropping_it() {
    let parsed = parse_html(
        "<html><body><div itemscope><span itemprop=\"name\">Item</span></div></body></html>",
        "https://example.com",
    )
    .unwrap();
    let item = parsed
        .structured_data
        .iter()
        .find(|data| data.format == "Microdata")
        .unwrap();
    assert!(item
        .validation_issues
        .iter()
        .any(|issue| issue.code == "microdata-itemtype-missing"));
}

#[test]
fn test_rdfa_extraction_preserves_declared_attributes() {
    let parsed = parse_html(
        "<html><body vocab=\"https://schema.org/\"><article typeof=\"Article\" about=\"https://example.com/post\"><span property=\"headline\">Title</span></article></body></html>",
        "https://example.com",
    )
    .unwrap();
    let article = parsed
        .structured_data
        .iter()
        .find(|item| item.format == "RDFa" && item.data_type == "Article")
        .expect("declared RDFa typeof should be extracted");

    assert_eq!(article.content["about"], "https://example.com/post");
    assert!(parsed
        .structured_data
        .iter()
        .any(|item| item.format == "RDFa" && item.data_type == "property: headline"));
}

#[test]
fn preserves_microdata_references_and_rdfa_relation_attributes_for_validation() {
    let parsed = parse_html(
        r#"<html><body>
          <div itemscope itemtype="https://schema.org/Product" itemid="https://example.com/product/1" itemref="product-details">
            <span itemprop="name">Example</span>
          </div>
          <div vocab="https://schema.org/" typeof="Product" rel="related" rev="isPartOf" datatype="https://schema.org/Text" content="Example" prefix="schema: https://schema.org/"></div>
          <span id="product-details" itemprop="description">Description</span>
        </body></html>"#,
        "https://example.com",
    )
    .unwrap();
    let microdata = parsed
        .structured_data
        .iter()
        .find(|item| item.format == "Microdata")
        .expect("microdata should be extracted");
    assert_eq!(microdata.content["itemid"], "https://example.com/product/1");
    assert_eq!(microdata.content["itemref"][0], "product-details");
    let rdfa = parsed
        .structured_data
        .iter()
        .find(|item| item.format == "RDFa" && item.data_type == "Product")
        .expect("RDFa should be extracted");
    assert_eq!(rdfa.content["rel"], "related");
    assert_eq!(rdfa.content["rev"], "isPartOf");
    assert_eq!(rdfa.content["prefix"], "schema: https://schema.org/");
}

#[test]
fn test_content_statistics() {
    let parsed = parse_html(SAMPLE_HTML, "https://example.com").unwrap();
    assert!(parsed.content_stats.word_count > 0);
    assert!(parsed.content_stats.text_ratio_percent > 0.0);
    assert!(parsed
        .content_stats
        .body_text
        .contains("comprehensive SEO analysis"));
    assert!(parsed.content_stats.sentence_count > 0);
    assert!(parsed.content_stats.average_words_per_sentence > 0.0);
    assert!(parsed.content_stats.average_characters_per_word > 0.0);
    assert!(parsed.content_stats.complexity_score > 0);
    assert_ne!(parsed.content_stats.complexity_label, "unavailable");
    assert!(parsed.content_stats.readability_ease_score > 0.0);
    assert!(parsed.content_stats.readability_grade >= 0.0);
    assert_eq!(parsed.content_stats.readability_method, "flesch-en");
    assert_ne!(parsed.content_stats.readability_label, "unavailable");
    assert!(parsed
        .content_stats
        .top_keywords
        .iter()
        .all(|keyword| keyword.density_percent > 0.0));
}

#[test]
fn polish_function_words_are_filtered_and_grade_is_bounded() {
    let parsed = parse_html(
        r#"<html lang="pl"><body><p>Więcej czytaj twojej audyt audyt strony.</p></body></html>"#,
        "https://example.com",
    )
    .unwrap();
    assert!(parsed.content_stats.readability_grade <= 100.0);
    for keyword in &parsed.content_stats.top_keywords {
        assert!(!["więcej", "czytaj", "twojej"].contains(&keyword.keyword.as_str()));
    }
}

#[test]
fn uses_polish_readability_formula_when_html_declares_polish() {
    let polish = parse_html(
        "<html lang=\"pl-PL\"><body>To jest przykładowy tekst, który pokazuje polską formułę czytelności. Zdanie ma kilka słów i powinno otrzymać lokalny wzór.</body></html>",
        "https://example.com",
    )
    .unwrap();
    let english = parse_html(
        "<html lang=\"en\"><body>To jest przykładowy tekst, który pokazuje polską formułę czytelności. Zdanie ma kilka słów i powinno otrzymać lokalny wzór.</body></html>",
        "https://example.com",
    )
    .unwrap();

    assert_eq!(polish.content_stats.readability_method, "flesch-pl");
    assert_ne!(english.content_stats.readability_method, "flesch-pl");
    assert_ne!(
        polish.content_stats.readability_ease_score,
        english.content_stats.readability_ease_score
    );
}

#[test]
fn infers_polish_readability_formula_when_lang_is_missing() {
    let parsed = parse_html(
        "<html><body>To jest tekst, który pokazuje polską treść. Jest to kolejny fragment, który ma lokalny wzór.</body></html>",
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.content_stats.readability_method, "flesch-pl");
}

#[test]
fn selects_locale_specific_readability_formulas_for_supported_languages() {
    let body = "This is a bounded readability sample with several words in two sentences. It is deliberately long enough for the local formula.";
    for (language, expected) in [
        ("de", "flesch-de"),
        ("it", "flesch-it"),
        ("pt", "flesch-pt"),
        ("ru", "flesch-ru"),
    ] {
        let html = format!("<html lang=\"{language}\"><body>{body}</body></html>");
        let parsed = parse_html(&html, "https://example.com").unwrap();
        assert_eq!(
            parsed.content_stats.readability_method, expected,
            "language {language}"
        );
    }
}

#[test]
fn filters_common_supported_locale_stop_words_from_frequency_report() {
    let parsed = parse_html(
        "<html lang=\"de\"><body>und und der die das y y le le SEO SEO SEO</body></html>",
        "https://example.com",
    )
    .unwrap();
    let keywords = parsed
        .content_stats
        .top_keywords
        .iter()
        .map(|keyword| keyword.keyword.as_str())
        .collect::<Vec<_>>();
    assert!(keywords.contains(&"seo"));
    assert!(!keywords.contains(&"und"));
    assert!(!keywords.contains(&"der"));
    assert!(!keywords.contains(&"die"));
    assert!(!keywords.contains(&"das"));
    assert!(!keywords.contains(&"le"));
}

#[test]
fn detects_only_evidence_backed_html_technology_signals() {
    let parsed = parse_html(
        "<html><head><meta name=\"generator\" content=\"WordPress 6.6\"><script src=\"https://plausible.io/js/script.js\"></script></head><body><script src=\"/_next/app.js\"></script><img src=\"/wp-content/logo.png\"></body></html>",
        "https://example.com",
    )
    .unwrap();

    assert!(parsed
        .technical
        .technology_signals
        .iter()
        .any(|signal| signal.name == "WordPress"));
    assert!(parsed
        .technical
        .technology_signals
        .iter()
        .any(|signal| signal.name == "Next.js"));
    assert!(parsed
        .technical
        .technology_signals
        .iter()
        .any(|signal| signal.name == "Plausible Analytics" && signal.confidence == "confirmed"));
}

#[test]
fn detects_framework_and_library_markers_without_inventing_versions() {
    let parsed = parse_html(
        r#"<html><head><script src="/assets/jquery.min.js"></script><link rel="stylesheet" href="/css/bootstrap.min.css"></head><body><app-root ng-version="17.2.1" _nghost-a><div data-v-app data-svelte-h="abc"></div><div x-data="{}"></div></app-root></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    let signal = |name: &str| {
        parsed
            .technical
            .technology_signals
            .iter()
            .find(|signal| signal.name == name)
            .unwrap_or_else(|| panic!("missing technology signal: {name}"))
    };
    assert_eq!(signal("Angular").confidence, "confirmed");
    assert_eq!(signal("Angular").version.as_deref(), Some("17.2.1"));
    assert_eq!(signal("jQuery").confidence, "confirmed");
    assert_eq!(signal("Bootstrap").confidence, "confirmed");
    assert_eq!(signal("Vue.js").confidence, "heuristic");
    assert_eq!(signal("Svelte").confidence, "heuristic");
    assert_eq!(signal("Alpine.js").confidence, "heuristic");
    assert!(signal("jQuery").version.is_none());
}

#[test]
fn does_not_treat_lookalike_framework_text_as_a_technology_marker() {
    let parsed = parse_html(
        "<html><head><script src=\"/js/notjquery.js\"></script><script src=\"/js/tailwindcss-like.js\"></script><link rel=\"stylesheet\" href=\"/css/bootstrapper.css\"></head><body><p>jquery is mentioned in an article; bootstrapper and tailwindcss-like are not assets</p></body></html>",
        "https://example.com",
    )
    .unwrap();
    assert!(!parsed
        .technical
        .technology_signals
        .iter()
        .any(|signal| matches!(
            signal.name.as_str(),
            "jQuery" | "Bootstrap" | "Tailwind CSS"
        )));
}

#[test]
fn versions_are_extracted_only_from_known_explicit_generator_declarations() {
    let declared = parse_html(
        "<html><head><meta name=\"generator\" content=\"WordPress 6.6.2\"></head><body><img src=\"/wp-content/logo.png\"></body></html>",
        "https://example.com",
    )
    .unwrap();
    let wordpress = declared
        .technical
        .technology_signals
        .iter()
        .find(|signal| signal.name == "WordPress")
        .unwrap();
    assert_eq!(wordpress.version.as_deref(), Some("6.6.2"));
    assert_eq!(wordpress.confidence, "confirmed");

    let heuristic = parse_html(
        "<html><body><img src=\"/wp-content/logo.png\"></body></html>",
        "https://example.com",
    )
    .unwrap();
    let wordpress = heuristic
        .technical
        .technology_signals
        .iter()
        .find(|signal| signal.name == "WordPress")
        .unwrap();
    assert_eq!(wordpress.version, None);
    assert_eq!(wordpress.confidence, "heuristic");

    let lookalike = parse_html(
        "<html><head><meta name=\"generator\" content=\"WordPressish 99.0\"></head></html>",
        "https://example.com",
    )
    .unwrap();
    assert!(!lookalike
        .technical
        .technology_signals
        .iter()
        .any(|signal| signal.name == "WordPress"));
}

#[test]
fn extracts_document_language_landmarks_aria_and_unlabeled_controls() {
    let parsed = parse_html(
        "<html lang=\"pl\"><body><header><nav aria-label=\"Główna\"></nav></header><main><label for=\"email\">E-mail</label><input id=\"email\"><input name=\"without-label\"></main></body></html>",
        "https://example.com",
    )
    .unwrap();

    assert_eq!(
        parsed.accessibility.document_language.as_deref(),
        Some("pl")
    );
    assert!(parsed
        .accessibility
        .landmarks
        .iter()
        .any(|landmark| landmark.name == "main" && landmark.count == 1));
    assert_eq!(parsed.accessibility.aria_attribute_count, 1);
    assert_eq!(parsed.accessibility.form_control_count, 2);
    assert_eq!(parsed.accessibility.unlabeled_form_control_count, 1);
}

#[test]
fn unlabeled_control_finding_identifies_source_position_and_redacts_control_values() {
    let parsed = parse_html(
        r#"<html><body><input type="hidden" name="csrf" value="private-token"><input type="text" name="company-honeypot" class="honeypot" value="private-honeypot"><label for="email">Email</label><input id="email"><form><input type="email" name="contact" placeholder="name@example.com" value="private-email" data-secret="private-data"><textarea name="message"></textarea><select name="plan"><option>Basic</option></select></form></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.accessibility.anti_spam_text_control_count, 1);
    assert_eq!(parsed.accessibility.form_control_count, 4);
    assert_eq!(parsed.accessibility.unlabeled_form_control_count, 3);
    let finding = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-form-controls-unlabeled")
        .unwrap();

    assert_eq!(finding.elements.len(), 3);
    assert_eq!(finding.elements[0].dom_position, 4);
    assert_eq!(finding.elements[0].line, Some(1));
    assert!(finding.elements[0].column.is_some());
    assert_eq!(
        finding.elements[0].dom_query,
        "document.querySelectorAll('input, select, textarea')[3]"
    );
    assert!(finding.elements[0].html_snippet.contains("type=\"email\""));
    assert!(finding.elements[0]
        .html_snippet
        .contains("name=\"contact\""));
    assert!(!finding.elements[0].html_snippet.contains("private-email"));
    assert!(!finding.elements[0].html_snippet.contains("private-token"));
    assert!(!finding.elements[0].html_snippet.contains("private-data"));
    assert!(finding
        .elements
        .iter()
        .any(|element| element.html_snippet.starts_with("<textarea")));
    assert!(finding
        .elements
        .iter()
        .any(|element| element.html_snippet.starts_with("<select")));
    assert_eq!(parsed.accessibility.hidden_form_control_count, 1);
    assert_eq!(parsed.accessibility.anti_spam_text_controls.len(), 1);
    assert!(parsed.accessibility.anti_spam_text_controls[0]
        .html_snippet
        .contains("type=\"text\""));
    assert!(parsed.accessibility.anti_spam_text_controls[0]
        .html_snippet
        .contains("honeypot"));
    assert!(!parsed.accessibility.anti_spam_text_controls[0]
        .html_snippet
        .contains("private-honeypot"));
    assert_eq!(
        parsed.accessibility.hidden_form_controls[0].dom_query,
        "document.querySelectorAll('input, select, textarea')[0]"
    );
    assert!(parsed.accessibility.hidden_form_controls[0]
        .html_snippet
        .contains("type=\"hidden\""));
    assert!(!parsed.accessibility.hidden_form_controls[0]
        .html_snippet
        .contains("private-token"));
}

#[test]
fn accessibility_control_evidence_reports_multiline_source_location() {
    let parsed = parse_html(
        "<html>\n<body>\n<!-- <input name=\"fake-comment\"> -->\n<script>const fake = '<input name=\"fake-script\">';</script>\n<form>\n<input type=\"email\" name=\"contact\">\n</form>\n</body>\n</html>",
        "https://example.com",
    )
    .unwrap();

    let finding = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-form-controls-unlabeled")
        .unwrap();
    assert_eq!(finding.elements.len(), 1);
    assert_eq!(finding.elements[0].line, Some(6));
    assert_eq!(finding.elements[0].column, Some(1));
}

#[test]
fn empty_aria_labelledby_reference_does_not_hide_an_unlabelled_control() {
    let parsed = parse_html(
        r#"<html><body><span id="empty-label"></span><input type="email" aria-labelledby="empty-label"><span id="real-label">Email</span><input type="email" aria-labelledby="real-label"></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.accessibility.form_control_count, 2);
    assert_eq!(parsed.accessibility.unlabeled_form_control_count, 1);
    let finding = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-form-controls-unlabeled")
        .expect("empty aria-labelledby should be reported");
    assert_eq!(finding.elements.len(), 1);
    assert!(finding.elements[0]
        .html_snippet
        .contains("aria-labelledby=\"empty-label\""));
}

#[test]
fn accessibility_non_form_findings_report_selectors_source_locations_and_safe_snippets() {
    let parsed = parse_html(
        r#"<html><body><a href="/empty"></a><button></button><div role="button"></div><img src="/without-alt.png?token=private#frag"><img alt="" src="/decorative.png"></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    let interactive = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-interactive-name-missing")
        .expect("unnamed interactive finding");
    assert_eq!(interactive.elements.len(), 3);
    assert_eq!(
        interactive.elements[0].dom_query,
        "document.querySelectorAll(\"a[href], button, input[type='button'], input[type='submit'], input[type='reset'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']\")[0]"
    );
    assert_eq!(interactive.elements[0].line, Some(1));
    assert!(interactive.elements[0].html_snippet.starts_with("<a"));
    assert!(interactive.elements[1].html_snippet.starts_with("<button"));
    assert!(interactive.elements[2]
        .html_snippet
        .contains("role=\"button\""));

    let images = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-image-alt-missing")
        .expect("missing image alt finding");
    assert_eq!(images.elements.len(), 1);
    assert_eq!(
        images.elements[0].dom_query,
        "document.querySelectorAll('img:not([alt])')[0]"
    );
    assert_eq!(images.elements[0].line, Some(1));
    assert!(images.elements[0]
        .html_snippet
        .contains("src=\"/without-alt.png\""));
    assert!(!images.elements[0].html_snippet.contains("private"));
    assert!(!images.elements[0].html_snippet.contains("decorative.png"));
}

#[test]
fn reports_unnamed_custom_interactive_roles() {
    let parsed = parse_html(
        r#"<html><body><div role="checkbox"></div><span role="tab"></span><div role="link" aria-label="Named link"></div></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    let finding = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-interactive-name-missing")
        .expect("unnamed custom roles should be reported");
    assert_eq!(finding.elements.len(), 2);
    assert!(finding.elements[0]
        .html_snippet
        .contains("role=\"checkbox\""));
    assert!(finding.elements[1].html_snippet.contains("role=\"tab\""));
}

#[test]
fn flags_marked_honeypots_that_use_hidden_type_without_counting_them_as_visible_controls() {
    let parsed = parse_html(
        r#"<html><body><form><input type="hidden" name="website" value="secret"><input type="hidden" name="website-honeypot" value="secret-too"><input type="text" name="company-honeypot" class="honeypot" value="also-secret"><label for="email">Email</label><input id="email" type="email"></form></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.accessibility.form_control_count, 1);
    assert_eq!(parsed.accessibility.unlabeled_form_control_count, 0);
    assert_eq!(parsed.accessibility.hidden_form_control_count, 2);
    assert_eq!(parsed.accessibility.anti_spam_text_control_count, 1);
    assert!(parsed.accessibility.anti_spam_text_controls[0]
        .html_snippet
        .contains("type=\"text\""));

    let finding = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-antispam-control-not-text")
        .expect("a honeypot marked as type=hidden should be reported");
    assert_eq!(finding.elements.len(), 2);
    assert_eq!(finding.elements[0].dom_position, 1);
    assert!(finding.elements[0].html_snippet.contains("type=\"hidden\""));
    assert!(finding.elements[0]
        .html_snippet
        .contains("name=\"website\""));
    assert!(!finding.elements[0].html_snippet.contains("secret"));
    assert!(finding.recommendation.contains("type=\"text\""));
    assert!(finding.recommendation.contains("type=\"hidden\""));
}

#[test]
fn detects_text_honeypots_with_equivalent_hidden_markers_without_mutating_their_type() {
    let parsed = parse_html(
        r#"<html><body><form><input type="text" name="website_url" aria-hidden="1" value="secret-one"><input type="text" id="company-url" style="content-visibility:hidden!important" value="secret-two"><input type="text" name="homepage_url" style="display: none !important" value="secret-three"><input type="text" name="company_website" style="position:absolute; left:-9999px" value="secret-four"><input id="email" type="text" name="email" aria-hidden="1" value="private-email"><label for="email">E-mail</label></form></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.accessibility.form_control_count, 1);
    assert_eq!(parsed.accessibility.unlabeled_form_control_count, 0);
    assert_eq!(parsed.accessibility.anti_spam_text_control_count, 4);
    assert_eq!(parsed.accessibility.anti_spam_text_controls.len(), 4);
    assert!(parsed
        .accessibility
        .anti_spam_text_controls
        .iter()
        .all(|control| control.html_snippet.contains("type=\"text\"")));
    assert!(parsed
        .accessibility
        .anti_spam_text_controls
        .iter()
        .all(|control| !control.html_snippet.contains("secret-")));
}

#[test]
fn legacy_accessibility_findings_deserialize_without_element_locations() {
    let finding: AccessibilityFinding = serde_json::from_str(
        r#"{"code":"legacy","severity":"warning","message":"Old finding","evidence":"Old evidence","recommendation":"Old recommendation"}"#,
    )
    .unwrap();

    assert!(finding.elements.is_empty());
}

#[test]
fn reports_static_wcag_related_markup_findings_with_evidence() {
    let parsed = parse_html(
        "<html lang=\"en_US\"><body><main></main><main></main><a href=\"/empty\"></a><button></button><img src=\"/photo.jpg\"><div id=\"duplicate\"></div><span id=\"duplicate\"></span><div aria-labelledby=\"missing-label\"></div></body></html>",
        "https://example.com",
    )
    .unwrap();

    let codes = parsed
        .accessibility
        .findings
        .iter()
        .map(|finding| finding.code.as_str())
        .collect::<HashSet<_>>();
    for expected in [
        "accessibility-document-language-invalid",
        "accessibility-multiple-main-landmarks",
        "accessibility-interactive-name-missing",
        "accessibility-image-alt-missing",
        "accessibility-duplicate-id",
        "accessibility-aria-reference-unresolved",
    ] {
        assert!(codes.contains(expected), "missing finding: {expected}");
    }
    assert!(parsed.accessibility.findings.iter().all(|finding| {
        !finding.message.is_empty()
            && !finding.evidence.is_empty()
            && !finding.recommendation.is_empty()
    }));
    let duplicate_id = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-duplicate-id")
        .expect("duplicate id finding");
    assert_eq!(duplicate_id.elements.len(), 2);
    assert_eq!(duplicate_id.elements[0].dom_position, 1);
    assert_eq!(duplicate_id.elements[0].line, Some(1));
    assert_eq!(
        duplicate_id.elements[0].dom_query,
        "document.querySelectorAll('[id]')[0]"
    );
    assert!(duplicate_id.elements[0]
        .html_snippet
        .contains("id=\"duplicate\""));
    let aria_reference = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-aria-reference-unresolved")
        .expect("unresolved ARIA reference finding");
    assert_eq!(aria_reference.elements.len(), 1);
    assert_eq!(aria_reference.elements[0].dom_position, 1);
    assert!(aria_reference.elements[0]
        .dom_query
        .starts_with("document.querySelectorAll('[aria-labelledby]"));
    assert!(aria_reference.elements[0]
        .html_snippet
        .contains("aria-labelledby=\"missing-label\""));
    let invalid_language = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-document-language-invalid")
        .expect("invalid document language finding");
    assert_eq!(invalid_language.elements.len(), 1);
    assert_eq!(
        invalid_language.elements[0].dom_query,
        "document.querySelectorAll('html')[0]"
    );
    assert!(invalid_language.elements[0]
        .html_snippet
        .contains("lang=\"en_US\""));
    let multiple_main = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-multiple-main-landmarks")
        .expect("multiple main finding");
    assert_eq!(multiple_main.elements.len(), 2);
    assert!(multiple_main.elements[0]
        .dom_query
        .starts_with("document.querySelectorAll(\"main, [role='main']\")[0]"));
    assert!(parsed.accessibility.manual_review_items.len() >= 3);
}

#[test]
fn reports_focusable_elements_inside_aria_hidden_with_safe_source_evidence() {
    let parsed = parse_html(
        r#"<html><body><div aria-hidden="true"><button id="hidden-action">Run</button><a href="/hidden">Hidden link</a><input type="text" name="honeypot" value="secret"><input type="text" id="disabled" disabled><input type="hidden" name="token" value="private"></div></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    let finding = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-focusable-aria-hidden")
        .expect("focusable aria-hidden elements should be reported");
    assert_eq!(finding.elements.len(), 2);
    assert!(finding.message.contains('2'));
    assert_eq!(finding.elements[0].dom_position, 1);
    assert_eq!(finding.elements[1].dom_position, 2);
    assert!(finding.elements[0].dom_query.contains("a[href]"));
    assert!(finding.elements[0].html_snippet.contains("hidden-action"));
    assert!(finding.elements[1]
        .html_snippet
        .contains("href=\"/hidden\""));
    assert_eq!(finding.elements[0].line, Some(1));
    assert!(finding.elements[0].column.is_some());
    assert!(!finding.elements[0].html_snippet.contains("secret"));
    assert!(!finding.elements[0].html_snippet.contains("private"));
}

#[test]
fn ignores_disabled_or_aria_disabled_focusable_elements_in_aria_hidden() {
    let parsed = parse_html(
        r#"<html><body><div aria-hidden="true"><button disabled>Disabled</button><a href="/disabled" aria-disabled="true">Disabled link</a><button hidden>Hidden</button><button inert>Inert</button><button style="display:none">CSS hidden</button><button aria-disabled="false">Allowed</button></div></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    let finding = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-focusable-aria-hidden")
        .expect("the enabled button should keep the finding present");
    assert_eq!(finding.elements.len(), 1);
    assert!(finding.elements[0]
        .html_snippet
        .contains("aria-disabled=\"false\""));
}

#[test]
fn does_not_change_antispam_text_field_type_when_inside_aria_hidden() {
    let parsed = parse_html(
        r#"<html><body><div aria-hidden="true"><input type="text" name="website" class="honeypot" value="secret"></div></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert!(parsed
        .accessibility
        .findings
        .iter()
        .all(|finding| finding.code != "accessibility-focusable-aria-hidden"));
    assert_eq!(parsed.accessibility.anti_spam_text_control_count, 1);
    assert!(parsed.accessibility.anti_spam_text_controls[0]
        .html_snippet
        .contains("type=\"text\""));
}

#[test]
fn recognizes_conventional_text_honeypot_hidden_by_aria_hidden_ancestor() {
    let parsed = parse_html(
        r#"<html><body><form><div aria-hidden="true"><input type="text" name="website" value="secret"></div><label for="email">Email</label><input id="email" type="email"></form></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.accessibility.form_control_count, 1);
    assert_eq!(parsed.accessibility.unlabeled_form_control_count, 0);
    assert_eq!(parsed.accessibility.anti_spam_text_control_count, 1);
    assert!(parsed
        .accessibility
        .findings
        .iter()
        .all(|finding| { finding.code != "accessibility-focusable-aria-hidden" }));
    assert!(parsed.accessibility.anti_spam_text_controls[0]
        .html_snippet
        .contains("type=\"text\""));
}

#[test]
fn recognizes_conventional_text_honeypot_hidden_by_inert_or_css_ancestor() {
    let parsed = parse_html(
        r#"<html><body><form><div inert><input type="text" name="website" value="secret-one"></div><div style="display:none!important"><input type="text" name="company_url" value="secret-two"></div><label for="email">Email</label><input id="email" type="email"></form></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.accessibility.form_control_count, 1);
    assert_eq!(parsed.accessibility.unlabeled_form_control_count, 0);
    assert_eq!(parsed.accessibility.anti_spam_text_control_count, 2);
    assert!(parsed
        .accessibility
        .anti_spam_text_controls
        .iter()
        .all(|field| {
            field.html_snippet.contains("type=\"text\"") && !field.html_snippet.contains("secret-")
        }));
}

#[test]
fn ignores_script_and_style_payload_in_body_text() {
    let parsed = parse_html(
        "<html><body><p>Visible audit copy</p><script>secretKeyphrase()</script><style>.secret{display:none}</style></body></html>",
        "https://example.com",
    )
    .unwrap();

    assert!(parsed
        .content_stats
        .body_text
        .contains("Visible audit copy"));
    assert!(!parsed.content_stats.body_text.contains("secretKeyphrase"));
}

#[test]
fn content_statistics_ignore_site_chrome_and_forms_when_semantic_root_exists() {
    let parsed = parse_html(
        r#"<html><body>
            <header>Header keyword should not count</header>
            <nav>Navigation keyword should not count</nav>
            <aside>Sidebar keyword should not count</aside>
            <form><p>Form keyword should not count</p></form>
            <main><article><p>Main content target.</p></article></main>
            <footer>Footer keyword should not count</footer>
        </body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.content_stats.word_count, 3);
    assert_eq!(parsed.content_stats.body_text, "Main content target.");
    assert!(!parsed.content_stats.body_text.contains("keyword"));
    assert!(parsed
        .content_stats
        .top_keywords
        .iter()
        .all(|keyword| !keyword.keyword.contains("keyword")));
}
