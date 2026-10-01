use crate::models::audit_data::{
    AccessibilityAudit, AccessibilityElementEvidence, AccessibilityFinding, AccessibilityLandmark,
    ContentStats, FaviconData, HreflangTag, KeywordStat, MetaTag, MetaTags, StructuredData,
    TechnicalData, TechnologySignal,
};
use crate::services::schema_validator;
use anyhow::Result;
use scraper::{node::Node, ElementRef, Html, Selector};
use std::collections::{HashMap, HashSet};
use url::Url;

pub struct ParsedHtmlData {
    pub meta_tags: MetaTags,
    pub technical: TechnicalData,
    pub structured_data: Vec<StructuredData>,
    pub content_stats: ContentStats,
    pub accessibility: AccessibilityAudit,
}

/// Parses HTML document and extracts meta tags, technical indicators, structured data, and content stats
pub fn parse_html(html_str: &str, base_url: &str) -> Result<ParsedHtmlData> {
    let document = Html::parse_document(html_str);
    let parsed_base = Url::parse(base_url).ok();

    // 1. Extract <title>
    let title_selector = Selector::parse("title").unwrap();
    let title_text = document
        .select(&title_selector)
        .next()
        .map(|el| el.text().collect::<Vec<_>>().join(" ").trim().to_string());

    let title_len = title_text.as_ref().map(|t| t.chars().count()).unwrap_or(0);

    // 2. Parse all <meta> tags
    let meta_selector = Selector::parse("meta").unwrap();
    let mut description: Option<String> = None;
    let mut keywords: Option<String> = None;
    let mut robots: Option<String> = None;
    let mut viewport: Option<String> = None;
    let mut charset: Option<String> = None;
    let mut author: Option<String> = None;
    let mut generator: Option<String> = None;
    let mut theme_color: Option<String> = None;
    let mut other_tags = Vec::new();

    for el in document.select(&meta_selector) {
        let name = el.value().attr("name").map(|s| s.trim().to_string());
        let prop = el.value().attr("property").map(|s| s.trim().to_string());
        let http_equiv = el
            .value()
            .attr("http-equiv")
            .map(|s| s.trim().to_lowercase());
        let content = el.value().attr("content").unwrap_or("").trim().to_string();

        if let Some(cs) = el.value().attr("charset") {
            charset = Some(cs.trim().to_string());
        } else if http_equiv.as_deref() == Some("content-type") && charset.is_none() {
            if let Some(pos) = content.to_lowercase().find("charset=") {
                charset = Some(content[pos + 8..].trim().to_string());
            }
        }

        let name_lower = name.as_deref().unwrap_or("").to_lowercase();
        match name_lower.as_str() {
            "description" => description = Some(content.clone()),
            "keywords" => keywords = Some(content.clone()),
            "robots" => robots = Some(content.clone()),
            "viewport" => viewport = Some(content.clone()),
            "author" => author = Some(content.clone()),
            "generator" => generator = Some(content.clone()),
            "theme-color" => theme_color = Some(content.clone()),
            _ => {
                if !content.is_empty() || name.is_some() || prop.is_some() {
                    other_tags.push(MetaTag {
                        name: name.clone(),
                        property: prop.clone(),
                        content: content.clone(),
                    });
                }
            }
        }
    }

    // 3. Extract canonical URL (<link rel="canonical" href="...">)
    let canonical_selector = Selector::parse("link[rel~='canonical']").unwrap();
    let canonical = document
        .select(&canonical_selector)
        .next()
        .and_then(|el| el.value().attr("href"))
        .map(|href| resolve_url(href.trim(), parsed_base.as_ref()));

    let desc_len = description.as_ref().map(|d| d.chars().count()).unwrap_or(0);

    let meta_tags = MetaTags {
        title: title_text,
        title_length: title_len,
        description,
        description_length: desc_len,
        keywords,
        robots,
        canonical,
        viewport,
        charset,
        author,
        generator,
        theme_color,
        other_tags,
    };

    // 4. Extract Favicon
    let favicon_selector = Selector::parse("link[rel]").unwrap();
    let favicons = document
        .select(&favicon_selector)
        .filter_map(|element| {
            let rel = element.value().attr("rel")?.trim();
            let rel_lower = rel.to_ascii_lowercase();
            if !rel_lower.split_ascii_whitespace().any(|token| {
                token == "icon"
                    || token == "shortcut"
                    || token == "apple-touch-icon"
                    || token == "mask-icon"
            }) {
                return None;
            }
            let href = element.value().attr("href")?.trim();
            if href.is_empty() {
                return None;
            }
            let resolved = resolve_url(href, parsed_base.as_ref());
            let clean_path = resolved
                .split('?')
                .next()
                .unwrap_or(&resolved)
                .split('#')
                .next()
                .unwrap_or(&resolved)
                .to_ascii_lowercase();
            let inferred_format = if clean_path.starts_with("data:image/") {
                clean_path
                    .trim_start_matches("data:image/")
                    .split(';')
                    .next()
                    .filter(|value| !value.is_empty())
                    .map(str::to_string)
            } else {
                clean_path
                    .rsplit('.')
                    .next()
                    .filter(|extension| *extension != clean_path)
                    .map(str::to_string)
            };
            Some(FaviconData {
                href: resolved,
                rel: rel.to_string(),
                declared_type: element
                    .value()
                    .attr("type")
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string),
                declared_sizes: element
                    .value()
                    .attr("sizes")
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string),
                inferred_format,
            })
        })
        .fold(Vec::new(), |mut unique, favicon| {
            if !unique.iter().any(|existing: &FaviconData| {
                existing.href == favicon.href && existing.rel == favicon.rel
            }) {
                unique.push(favicon);
            }
            unique
        });
    let favicon = favicons.first().map(|entry| entry.href.clone());

    // 5. Extract Hreflang tags (<link rel="alternate" hreflang="..." href="...">)
    let hreflang_selector = Selector::parse("link[rel~='alternate'][hreflang]").unwrap();
    let mut hreflang_tags = Vec::new();
    for el in document.select(&hreflang_selector) {
        if let (Some(lang), Some(href)) = (el.value().attr("hreflang"), el.value().attr("href")) {
            hreflang_tags.push(HreflangTag {
                hreflang: lang.trim().to_string(),
                href: resolve_url(href.trim(), parsed_base.as_ref()),
            });
        }
    }

    // 6. Infer robots.txt & sitemap.xml URLs
    let robots_txt_url = parsed_base.as_ref().map(|base| {
        format!(
            "{}://{}/robots.txt",
            base.scheme(),
            base.host_str().unwrap_or("")
        )
    });
    let sitemap_url = parsed_base.as_ref().map(|base| {
        format!(
            "{}://{}/sitemap.xml",
            base.scheme(),
            base.host_str().unwrap_or("")
        )
    });

    let technical = TechnicalData {
        content_type: None, // Filled by http headers later
        server: None,
        favicon,
        favicons,
        robots_txt_url,
        sitemap_url,
        hreflang_tags,
        technology_signals: detect_html_technologies(
            &document,
            html_str,
            meta_tags.generator.as_deref(),
        ),
    };

    // 7. Extract Structured Data (JSON-LD and Microdata)
    let structured_data = extract_structured_data(&document);

    // 8. Extract Content Statistics
    let document_language = document
        .select(&Selector::parse("html").expect("static html selector is valid"))
        .next()
        .and_then(|element| element.value().attr("lang"));
    let content_stats = extract_content_stats(&document, html_str.len(), document_language);
    let accessibility = extract_accessibility(&document, html_str);

    Ok(ParsedHtmlData {
        meta_tags,
        technical,
        structured_data,
        content_stats,
        accessibility,
    })
}

fn extract_accessibility(document: &Html, html_str: &str) -> AccessibilityAudit {
    let html_selector = Selector::parse("html").expect("static html selector is valid");
    let document_language = document
        .select(&html_selector)
        .next()
        .and_then(|element| element.value().attr("lang"))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    let labels_selector = Selector::parse("label[for]").expect("static label selector is valid");
    let labels_for = document
        .select(&labels_selector)
        .filter_map(|label| {
            let id = label.value().attr("for")?.trim();
            let has_text = label
                .text()
                .any(|text| text.chars().any(|character| !character.is_whitespace()));
            (has_text && !id.is_empty()).then_some(id)
        })
        .collect::<HashSet<_>>();

    let all_elements_selector = Selector::parse("*").expect("static universal selector is valid");
    let controls_selector =
        Selector::parse("input, select, textarea").expect("static controls selector is valid");
    let mut landmark_counts = std::collections::BTreeMap::new();
    let mut aria_attribute_count = 0;
    let mut ids = HashSet::new();
    let mut nonempty_id_names = HashSet::new();
    let mut duplicate_id_values = HashSet::new();
    let mut duplicate_id_count = 0;
    let mut duplicate_ids = Vec::new();
    let mut unresolved_aria_reference_count = 0;
    let mut unresolved_aria_references = Vec::new();
    for element in document.select(&all_elements_selector) {
        if let Some(id) = element
            .value()
            .attr("id")
            .map(str::trim)
            .filter(|id| !id.is_empty())
        {
            if element
                .text()
                .any(|text| text.chars().any(|character| !character.is_whitespace()))
                || element
                    .value()
                    .attr("aria-label")
                    .is_some_and(|value| !value.trim().is_empty())
                || element
                    .value()
                    .attr("title")
                    .is_some_and(|value| !value.trim().is_empty())
            {
                nonempty_id_names.insert(id.to_string());
            }
            if !ids.insert(id.to_string()) {
                duplicate_id_count += 1;
                duplicate_id_values.insert(id.to_string());
                if duplicate_ids.len() < 10 && !duplicate_ids.iter().any(|existing| existing == id)
                {
                    duplicate_ids.push(id.to_string());
                }
            }
        }
    }
    for element in document.select(&all_elements_selector) {
        aria_attribute_count += element
            .value()
            .attrs()
            .filter(|(name, _)| name.to_ascii_lowercase().starts_with("aria-"))
            .count();
        for attribute in [
            "aria-labelledby",
            "aria-describedby",
            "aria-controls",
            "aria-owns",
            "aria-flowto",
            "aria-details",
            "aria-errormessage",
        ] {
            if let Some(value) = element.value().attr(attribute) {
                for reference in value.split_ascii_whitespace() {
                    if !reference.is_empty() && !ids.contains(reference) {
                        unresolved_aria_reference_count += 1;
                        if unresolved_aria_references.len() < 10 {
                            unresolved_aria_references.push((attribute, reference.to_string()));
                        }
                    }
                }
            }
        }
        let tag = element.value().name();
        let landmark = match tag {
            "main" => Some("main".to_string()),
            "nav" => Some("navigation".to_string()),
            "aside" => Some("complementary".to_string()),
            "footer" => Some("contentinfo".to_string()),
            "header" => Some("banner".to_string()),
            _ => match element
                .value()
                .attr("role")
                .map(|value| value.trim().to_ascii_lowercase())
            {
                Some(role)
                    if matches!(
                        role.as_str(),
                        "main"
                            | "navigation"
                            | "complementary"
                            | "contentinfo"
                            | "banner"
                            | "search"
                            | "region"
                    ) =>
                {
                    Some(role)
                }
                _ => None,
            },
        };
        if let Some(landmark) = landmark {
            *landmark_counts.entry(landmark).or_insert(0) += 1;
        }
    }

    let mut findings = Vec::new();
    let mut add_finding =
        |code: &str, severity: &str, message: String, evidence: String, recommendation: &str| {
            if findings.len() < 500 {
                findings.push(AccessibilityFinding {
                    code: code.to_string(),
                    severity: severity.to_string(),
                    message,
                    evidence,
                    recommendation: recommendation.to_string(),
                    elements: Vec::new(),
                });
            }
        };
    match document_language.as_deref() {
        None => add_finding(
            "accessibility-document-language-missing",
            "warning",
            "Dokument nie deklaruje języka na elemencie html.".into(),
            "Brak niepustego atrybutu html[lang].".into(),
            "Ustaw poprawny strukturalnie atrybut lang na elemencie html.",
        ),
        Some(language) if !is_structurally_valid_language_tag(language) => add_finding(
            "accessibility-document-language-invalid",
            "warning",
            "Wartość html[lang] ma niepoprawny kształt tagu językowego.".into(),
            format!("lang={language}"),
            "Użyj strukturalnie poprawnego tagu BCP 47; ten skan nie sprawdza aktualnego rejestru IANA.",
        ),
        _ => {}
    }
    let main_count = landmark_counts.get("main").copied().unwrap_or_default();
    if main_count == 0 {
        add_finding(
            "accessibility-main-landmark-missing",
            "info",
            "Nie wykryto głównego landmarku strony.".into(),
            "Brak elementu main lub role=main.".into(),
            "Oznacz główną treść pojedynczym elementem main albo role=main.",
        );
    } else if main_count > 1 {
        add_finding(
            "accessibility-multiple-main-landmarks",
            "warning",
            format!("Wykryto {main_count} główne landmarki."),
            format!("Liczba main / role=main: {main_count}"),
            "Pozostaw jeden główny landmark dla podstawowej treści dokumentu.",
        );
    }

    const HTML_SELECTOR: &str = "html";
    const MAIN_LANDMARK_SELECTOR: &str = "main, [role='main']";
    let html_selector_for_evidence =
        Selector::parse(HTML_SELECTOR).expect("static html evidence selector is valid");
    let html_elements = document
        .select(&html_selector_for_evidence)
        .enumerate()
        .take(50)
        .map(|(index, element)| {
            accessibility_element_evidence(&element, index + 1, HTML_SELECTOR, html_str)
        })
        .collect::<Vec<_>>();
    let main_landmark_selector = Selector::parse(MAIN_LANDMARK_SELECTOR)
        .expect("static main landmark evidence selector is valid");
    let main_landmark_elements = document
        .select(&main_landmark_selector)
        .enumerate()
        .take(50)
        .map(|(index, element)| {
            accessibility_element_evidence(&element, index + 1, MAIN_LANDMARK_SELECTOR, html_str)
        })
        .collect::<Vec<_>>();

    let mut form_control_count = 0;
    let mut unlabeled_form_control_count = 0;
    let mut hidden_form_control_count = 0;
    let mut hidden_form_controls = Vec::new();
    let mut anti_spam_text_control_count = 0;
    let mut anti_spam_text_controls = Vec::new();
    let mut anti_spam_non_text_control_count = 0;
    let mut anti_spam_non_text_controls = Vec::new();
    let mut unlabeled_form_controls = Vec::new();
    for (control_index, control) in document.select(&controls_selector).enumerate() {
        let input_type = control
            .value()
            .attr("type")
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase();
        if input_type == "hidden" {
            hidden_form_control_count += 1;
            if hidden_form_controls.len() < 50 {
                hidden_form_controls.push(accessibility_control_evidence(
                    &control,
                    control_index + 1,
                    html_str,
                ));
            }
            if is_explicitly_marked_anti_spam_control(&control)
                || is_hidden_conventional_anti_spam_field(&control)
            {
                anti_spam_non_text_control_count += 1;
                if anti_spam_non_text_controls.len() < 50 {
                    anti_spam_non_text_controls.push(accessibility_control_evidence(
                        &control,
                        control_index + 1,
                        html_str,
                    ));
                }
            }
            continue;
        }
        if input_type == "text" && is_marked_anti_spam_text_control(&control) {
            anti_spam_text_control_count += 1;
            if anti_spam_text_controls.len() < 50 {
                anti_spam_text_controls.push(accessibility_control_evidence(
                    &control,
                    control_index + 1,
                    html_str,
                ));
            }
            continue;
        }
        form_control_count += 1;
        let has_accessible_name = control
            .value()
            .attr("aria-label")
            .is_some_and(|value| !value.trim().is_empty())
            || control
                .value()
                .attr("aria-labelledby")
                .is_some_and(|value| {
                    value
                        .split_ascii_whitespace()
                        .any(|reference| nonempty_id_names.contains(reference))
                })
            || control
                .value()
                .attr("id")
                .is_some_and(|id| labels_for.contains(id))
            || control
                .ancestors()
                .filter_map(ElementRef::wrap)
                .any(|ancestor| {
                    ancestor.value().name() == "label"
                        && ancestor
                            .text()
                            .any(|text| text.chars().any(|character| !character.is_whitespace()))
                });
        if !has_accessible_name {
            unlabeled_form_control_count += 1;
            if unlabeled_form_controls.len() < 50 {
                unlabeled_form_controls.push(accessibility_control_evidence(
                    &control,
                    control_index + 1,
                    html_str,
                ));
            }
        }
    }

    if anti_spam_non_text_control_count > 0 {
        add_finding(
            "accessibility-antispam-control-not-text",
            "warning",
            format!(
                "Wykryto {} jawnie oznaczone{} pole antyspamowe z typem innym niż text.",
                anti_spam_non_text_control_count,
                if anti_spam_non_text_control_count == 1 {
                    ""
                } else {
                    " pola"
                }
            ),
            "Pola są wskazane poniżej; ich wartości nie są zapisywane.".into(),
            "Jeśli to pułapka honeypot, zachowaj input type=\"text\" i ukryj go wizualnie poza widokiem użytkownika. Nie zmieniaj go na type=\"hidden\", ponieważ boty często pomijają pola tego typu.",
        );
    }

    if form_control_count > 0 && unlabeled_form_control_count > 0 {
        add_finding(
            "accessibility-form-controls-unlabeled",
            "warning",
            format!("{unlabeled_form_control_count} z {form_control_count} kontrolek formularza w pobranym HTML nie ma wykrytej etykiety programowej."),
            format!("Nieopisane pola: {unlabeled_form_control_count}/{form_control_count}; szczegóły elementów podano poniżej."),
            "Powiąż każde pole z label[for], etykietą obejmującą kontrolkę, aria-label lub aria-labelledby.",
        );
    }

    if duplicate_id_count > 0 {
        add_finding(
            "accessibility-duplicate-id",
            "warning",
            format!("Wykryto {duplicate_id_count} powtórzonych identyfikatorów HTML."),
            format!("Przykłady: {}", duplicate_ids.join(", ")),
            "Nadaj elementom unikalne identyfikatory; etykiety i referencje ARIA zależą od jednoznacznych ID.",
        );
    }
    if unresolved_aria_reference_count > 0 {
        let examples = unresolved_aria_references
            .iter()
            .take(10)
            .map(|(attribute, reference)| format!("{attribute}={reference}"))
            .collect::<Vec<_>>()
            .join(", ");
        add_finding(
            "accessibility-aria-reference-unresolved",
            "warning",
            format!("Wykryto {unresolved_aria_reference_count} referencji ARIA do nieistniejących identyfikatorów."),
            examples,
            "Upewnij się, że każdy token atrybutu referencyjnego ARIA wskazuje istniejący element o unikalnym ID.",
        );
    }

    const DUPLICATE_ID_SELECTOR: &str = "[id]";
    const ARIA_REFERENCE_SELECTOR: &str = "[aria-labelledby], [aria-describedby], [aria-controls], [aria-owns], [aria-flowto], [aria-details], [aria-errormessage]";
    let duplicate_id_selector =
        Selector::parse(DUPLICATE_ID_SELECTOR).expect("static duplicate-id selector is valid");
    let duplicate_id_elements = document
        .select(&duplicate_id_selector)
        .enumerate()
        .filter_map(|(index, element)| {
            element
                .value()
                .attr("id")
                .map(str::trim)
                .filter(|id| duplicate_id_values.contains(*id))
                .map(|_| {
                    accessibility_element_evidence(
                        &element,
                        index + 1,
                        DUPLICATE_ID_SELECTOR,
                        html_str,
                    )
                })
        })
        .take(50)
        .collect::<Vec<_>>();

    let aria_reference_selector =
        Selector::parse(ARIA_REFERENCE_SELECTOR).expect("static ARIA reference selector is valid");
    let aria_reference_attributes = [
        "aria-labelledby",
        "aria-describedby",
        "aria-controls",
        "aria-owns",
        "aria-flowto",
        "aria-details",
        "aria-errormessage",
    ];
    let unresolved_aria_elements = document
        .select(&aria_reference_selector)
        .enumerate()
        .filter_map(|(index, element)| {
            let has_unresolved_reference = aria_reference_attributes.iter().any(|attribute| {
                element.value().attr(attribute).is_some_and(|value| {
                    value
                        .split_ascii_whitespace()
                        .any(|reference| !reference.is_empty() && !ids.contains(reference))
                })
            });
            has_unresolved_reference.then(|| {
                accessibility_element_evidence(
                    &element,
                    index + 1,
                    ARIA_REFERENCE_SELECTOR,
                    html_str,
                )
            })
        })
        .take(50)
        .collect::<Vec<_>>();

    const NAMED_ELEMENTS_SELECTOR: &str = "a[href], button, input[type='button'], input[type='submit'], input[type='reset'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']";
    let named_elements_selector =
        Selector::parse(NAMED_ELEMENTS_SELECTOR).expect("static named-element selector is valid");
    const FOCUSABLE_ARIA_HIDDEN_SELECTOR: &str = "a[href], button, input:not([type='hidden']), select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']";
    let focusable_aria_hidden_selector = Selector::parse(FOCUSABLE_ARIA_HIDDEN_SELECTOR)
        .expect("static aria-hidden focus selector is valid");
    let mut aria_hidden_focusable_count = 0;
    let mut aria_hidden_focusable_elements = Vec::new();
    for (focusable_index, element) in document.select(&focusable_aria_hidden_selector).enumerate() {
        let value = element.value();
        let input_type = value
            .attr("type")
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase();
        if input_type == "hidden"
            || is_marked_anti_spam_text_control(&element)
            || value.attr("disabled").is_some()
            || aria_hidden_value(value.attr("aria-disabled"))
            || focusability_blocked_by_markup(&element)
        {
            continue;
        }
        let hidden_by_aria = aria_hidden_value(value.attr("aria-hidden"))
            || element
                .ancestors()
                .filter_map(ElementRef::wrap)
                .any(|ancestor| aria_hidden_value(ancestor.value().attr("aria-hidden")));
        if !hidden_by_aria {
            continue;
        }
        aria_hidden_focusable_count += 1;
        if aria_hidden_focusable_elements.len() < 50 {
            aria_hidden_focusable_elements.push(accessibility_element_evidence(
                &element,
                focusable_index + 1,
                FOCUSABLE_ARIA_HIDDEN_SELECTOR,
                html_str,
            ));
        }
    }
    if aria_hidden_focusable_count > 0 {
        add_finding(
            "accessibility-focusable-aria-hidden",
            "warning",
            format!(
                "Wykryto {aria_hidden_focusable_count} elementów możliwych do fokusu w aria-hidden=true."
            ),
            format!(
                "Elementy interaktywne ukryte przed drzewem dostępności: {aria_hidden_focusable_count}."
            ),
            "Nie ukrywaj elementu możliwego do fokusu przez aria-hidden=true; usuń go z kolejności fokusu albo udostępnij go w drzewie dostępności.",
        );
    }
    let nonempty_alt_image_selector =
        Selector::parse("img[alt]:not([alt=''])").expect("static image selector is valid");
    let mut unnamed_interactive_count = 0;
    let mut unnamed_interactive = Vec::new();
    let mut unnamed_interactive_elements = Vec::new();
    for (interactive_index, element) in document.select(&named_elements_selector).enumerate() {
        let value = element.value();
        let labelled_by = value.attr("aria-labelledby").is_some_and(|refs| {
            refs.split_ascii_whitespace()
                .any(|id| nonempty_id_names.contains(id))
        });
        let has_name = value
            .attr("aria-label")
            .is_some_and(|name| !name.trim().is_empty())
            || labelled_by
            || value
                .attr("title")
                .is_some_and(|title| !title.trim().is_empty())
            || value
                .attr("value")
                .is_some_and(|text| !text.trim().is_empty())
            || element
                .text()
                .collect::<String>()
                .chars()
                .any(|character| !character.is_whitespace())
            || element
                .select(&nonempty_alt_image_selector)
                .next()
                .is_some();
        if !has_name {
            unnamed_interactive_count += 1;
            if unnamed_interactive_elements.len() < 50 {
                unnamed_interactive_elements.push(accessibility_element_evidence(
                    &element,
                    interactive_index + 1,
                    NAMED_ELEMENTS_SELECTOR,
                    html_str,
                ));
            }
            let selector_hint = value
                .attr("id")
                .map(|id| format!("#{}", id))
                .or_else(|| value.attr("href").map(|href| format!("a[href={href}]")))
                .unwrap_or_else(|| value.name().to_string());
            if unnamed_interactive.len() < 10 {
                unnamed_interactive.push(selector_hint);
            }
        }
    }
    if unnamed_interactive_count > 0 {
        add_finding(
            "accessibility-interactive-name-missing",
            "warning",
            format!("Wykryto {unnamed_interactive_count} linków lub kontrolek bez wykrytej nazwy dostępnej."),
            format!("Przykłady: {}", unnamed_interactive.join(", ")),
            "Nadaj linkom i kontrolkom zrozumiałą nazwę przez widoczny tekst, opisowy alt obrazu albo etykietę ARIA.",
        );
    }

    let images_selector =
        Selector::parse("img:not([alt])").expect("static image selector is valid");
    let mut images_without_alt_elements = Vec::new();
    for (image_index, element) in document.select(&images_selector).enumerate() {
        if images_without_alt_elements.len() < 50 {
            images_without_alt_elements.push(accessibility_element_evidence(
                &element,
                image_index + 1,
                "img:not([alt])",
                html_str,
            ));
        }
    }
    let images_without_alt = document.select(&images_selector).count();
    if images_without_alt > 0 {
        add_finding(
            "accessibility-image-alt-missing",
            "warning",
            format!("{images_without_alt} obrazów nie ma atrybutu alt."),
            format!("Liczba img bez alt: {images_without_alt}"),
            "Dodaj alt opisujący informację obrazu; dla obrazów czysto dekoracyjnych użyj alt=\"\".",
        );
    }

    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-form-controls-unlabeled")
    {
        finding.elements = unlabeled_form_controls;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-antispam-control-not-text")
    {
        finding.elements = anti_spam_non_text_controls;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-interactive-name-missing")
    {
        finding.elements = unnamed_interactive_elements;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-focusable-aria-hidden")
    {
        finding.elements = aria_hidden_focusable_elements;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-image-alt-missing")
    {
        finding.elements = images_without_alt_elements;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-duplicate-id")
    {
        finding.elements = duplicate_id_elements;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-aria-reference-unresolved")
    {
        finding.elements = unresolved_aria_elements;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-document-language-invalid")
    {
        finding.elements = html_elements;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-multiple-main-landmarks")
    {
        finding.elements = main_landmark_elements;
    }

    AccessibilityAudit {
        document_language,
        landmarks: landmark_counts
            .into_iter()
            .map(|(name, count)| AccessibilityLandmark { name, count })
            .collect(),
        aria_attribute_count,
        form_control_count,
        unlabeled_form_control_count,
        hidden_form_control_count,
        hidden_form_controls,
        anti_spam_text_control_count,
        anti_spam_text_controls,
        findings,
        manual_review_items: vec![
            "Kontrast tekstu i elementów interfejsu wymaga pomiaru w wyrenderowanych stanach strony.".to_string(),
            "Działanie klawiaturą, widoczność fokusu, pułapki fokusu i kolejność tabulacji wymagają testu interaktywnego.".to_string(),
            "Poprawność nazw, ról i stanów ARIA wymaga weryfikacji drzewa dostępności w przeglądarce czytnikiem ekranu.".to_string(),
        ],
    }
}

fn form_control_source_offset(source: &str, dom_position: usize) -> Option<usize> {
    if dom_position == 0 {
        return None;
    }
    let mut search_from = 0usize;
    let mut position = 0usize;
    while let Some(relative) = source.get(search_from..)?.find('<') {
        let tag_start = search_from + relative;
        let after_opening = tag_start + 1;
        if source[after_opening..].starts_with("!--") {
            search_from = source[after_opening..]
                .find("-->")
                .map_or(source.len(), |offset| after_opening + offset + 3);
            continue;
        }
        let next = source[after_opening..].chars().next()?;
        if matches!(next, '/' | '!' | '?') {
            search_from = after_opening;
            continue;
        }
        let name_end = source[after_opening..]
            .char_indices()
            .find(|(_, character)| {
                character.is_ascii_whitespace() || matches!(character, '>' | '/')
            })
            .map(|(offset, _)| after_opening + offset)
            .unwrap_or(source.len());
        let name = source.get(after_opening..name_end)?.to_ascii_lowercase();
        if matches!(name.as_str(), "script" | "style") {
            let closing_marker = format!("</{name}");
            let source_lower = source[after_opening..].to_ascii_lowercase();
            search_from = source_lower
                .find(&closing_marker)
                .map_or(source.len(), |offset| after_opening + offset);
            continue;
        }
        if matches!(name.as_str(), "input" | "select" | "textarea") {
            position += 1;
            if position == dom_position {
                return Some(tag_start);
            }
        }
        let mut quote = None;
        let mut tag_end = None;
        for (offset, character) in source[after_opening..].char_indices() {
            if let Some(active) = quote {
                if character == active {
                    quote = None;
                }
            } else if matches!(character, '\'' | '"') {
                quote = Some(character);
            } else if character == '>' {
                tag_end = Some(after_opening + offset);
                break;
            }
        }
        search_from = tag_end.map_or(source.len(), |offset| offset + 1);
    }
    None
}

fn source_line_column(source: &str, offset: usize) -> (Option<usize>, Option<usize>) {
    let offset = offset.min(source.len());
    if !source.is_char_boundary(offset) {
        return (None, None);
    }
    let prefix = &source[..offset];
    let line_start = prefix.rfind('\n').map_or(0, |index| index + 1);
    (
        Some(prefix.bytes().filter(|byte| *byte == b'\n').count() + 1),
        Some(source[line_start..offset].chars().count() + 1),
    )
}

/// Finds the source offset of an element in the same order as a browser's
/// `querySelectorAll` result for the small, deterministic selectors used by
/// the accessibility findings. The parser intentionally ignores comments and
/// script/style text so a literal `<img>` or `<button>` in JavaScript cannot
/// shift the reported location.
fn element_source_offset(
    source: &str,
    dom_position: usize,
    element: &ElementRef<'_>,
    selector: &str,
) -> Option<usize> {
    if dom_position == 0 {
        return None;
    }

    let expected_name = element.value().name();
    let mut search_from = 0usize;
    let mut position = 0usize;
    while let Some(relative) = source.get(search_from..)?.find('<') {
        let tag_start = search_from + relative;
        let after_opening = tag_start + 1;
        if source[after_opening..].starts_with("!--") {
            search_from = source[after_opening..]
                .find("-->")
                .map_or(source.len(), |offset| after_opening + offset + 3);
            continue;
        }
        let next = source[after_opening..].chars().next()?;
        if matches!(next, '/' | '!' | '?') {
            search_from = after_opening;
            continue;
        }

        let name_end = source[after_opening..]
            .char_indices()
            .find(|(_, character)| {
                character.is_ascii_whitespace() || matches!(character, '>' | '/')
            })
            .map(|(offset, _)| after_opening + offset)
            .unwrap_or(source.len());
        let name = source.get(after_opening..name_end)?.to_ascii_lowercase();

        let mut quote = None;
        let mut tag_end = None;
        for (offset, character) in source[after_opening..].char_indices() {
            if let Some(active) = quote {
                if character == active {
                    quote = None;
                }
            } else if matches!(character, '\'' | '"') {
                quote = Some(character);
            } else if character == '>' {
                tag_end = Some(after_opening + offset);
                break;
            }
        }
        let Some(tag_end) = tag_end else {
            break;
        };

        if name == "script" || name == "style" {
            let closing_marker = format!("</{name}");
            let source_lower = source[after_opening..].to_ascii_lowercase();
            search_from = source_lower
                .find(&closing_marker)
                .map_or(source.len(), |offset| after_opening + offset);
            continue;
        }

        if name == expected_name
            && source_tag_matches_selector(&source[tag_start..=tag_end], expected_name, selector)
        {
            position += 1;
            if position == dom_position {
                return Some(tag_start);
            }
        }
        search_from = tag_end + 1;
    }
    None
}

fn source_tag_matches_selector(tag: &str, element_name: &str, selector: &str) -> bool {
    let element_name = element_name.to_ascii_lowercase();
    match selector {
        "img:not([alt])" => element_name == "img" && source_attribute_value(tag, "alt").is_none(),
        "[id]" => source_attribute_value(tag, "id").is_some(),
        "html" => element_name == "html",
        "main, [role='main']" => {
            element_name == "main"
                || source_attribute_value(tag, "role")
                    .is_some_and(|value| value.trim().eq_ignore_ascii_case("main"))
        }
        "[aria-labelledby], [aria-describedby], [aria-controls], [aria-owns], [aria-flowto], [aria-details], [aria-errormessage]" => [
            "aria-labelledby",
            "aria-describedby",
            "aria-controls",
            "aria-owns",
            "aria-flowto",
            "aria-details",
            "aria-errormessage",
        ]
        .iter()
        .any(|attribute| source_attribute_value(tag, attribute).is_some()),
        "a[href], button, input[type='button'], input[type='submit'], input[type='reset'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']" => {
            (element_name == "a" && source_attribute_value(tag, "href").is_some())
                || element_name == "button"
                || (element_name == "input"
                    && source_attribute_value(tag, "type").is_some_and(|value| {
                        matches!(
                            value.trim().to_ascii_lowercase().as_str(),
                            "button" | "submit" | "reset"
                        )
                    }))
                || source_attribute_value(tag, "role").is_some_and(|value| {
                    matches!(
                        value.trim().to_ascii_lowercase().as_str(),
                        "button" | "link" | "checkbox" | "radio" | "switch" | "tab" | "menuitem"
                    )
                })
        }
        "a[href], button, input:not([type='hidden']), select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']" => {
            (element_name == "a" && source_attribute_value(tag, "href").is_some())
                || element_name == "button"
                || (element_name == "input"
                    && source_attribute_value(tag, "type").map_or(true, |value| {
                        !value.trim().eq_ignore_ascii_case("hidden")
                    }))
                || matches!(element_name.as_str(), "select" | "textarea")
                || (source_attribute_value(tag, "tabindex")
                    .is_some_and(|value| value.trim() != "-1"))
                || source_attribute_value(tag, "contenteditable")
                    .is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
                || source_attribute_value(tag, "role").is_some_and(|value| {
                    matches!(
                        value.trim().to_ascii_lowercase().as_str(),
                        "button" | "link" | "checkbox" | "radio" | "switch" | "tab" | "menuitem"
                    )
                })
        }
        _ => false,
    }
}

/// Reads one HTML attribute from a single opening tag. It accepts quoted and
/// unquoted values and boolean attributes, while never inspecting text after
/// the closing `>`.
fn source_attribute_value(tag: &str, requested: &str) -> Option<String> {
    let bytes = tag.as_bytes();
    let mut cursor = 1usize;
    while cursor < bytes.len() {
        while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        if cursor >= bytes.len() || matches!(bytes[cursor], b'>' | b'/') {
            break;
        }
        let name_start = cursor;
        while cursor < bytes.len()
            && !bytes[cursor].is_ascii_whitespace()
            && !matches!(bytes[cursor], b'=' | b'>' | b'/')
        {
            cursor += 1;
        }
        let name = tag.get(name_start..cursor)?;
        while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
            cursor += 1;
        }

        let value = if cursor < bytes.len() && bytes[cursor] == b'=' {
            cursor += 1;
            while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                cursor += 1;
            }
            if cursor >= bytes.len() {
                String::new()
            } else if matches!(bytes[cursor], b'\'' | b'"') {
                let quote = bytes[cursor];
                cursor += 1;
                let value_start = cursor;
                while cursor < bytes.len() && bytes[cursor] != quote {
                    cursor += 1;
                }
                let value = tag.get(value_start..cursor)?.to_string();
                if cursor < bytes.len() {
                    cursor += 1;
                }
                value
            } else {
                let value_start = cursor;
                while cursor < bytes.len()
                    && !bytes[cursor].is_ascii_whitespace()
                    && bytes[cursor] != b'>'
                {
                    cursor += 1;
                }
                tag.get(value_start..cursor)?.to_string()
            }
        } else {
            String::new()
        };

        if name.eq_ignore_ascii_case(requested) {
            return Some(value);
        }
    }
    None
}

fn accessibility_element_evidence(
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

fn accessibility_dom_query(selector: &str, index: usize) -> String {
    if selector.contains('\'') {
        format!(
            "document.querySelectorAll(\"{}\")[{index}]",
            selector.replace('"', "\\\"")
        )
    } else {
        format!("document.querySelectorAll('{selector}')[{index}]")
    }
}

fn accessibility_control_evidence(
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

fn is_marked_anti_spam_text_control(control: &ElementRef<'_>) -> bool {
    is_explicitly_marked_anti_spam_control(control)
        || is_hidden_conventional_anti_spam_field(control)
}

fn is_explicitly_marked_anti_spam_control(control: &ElementRef<'_>) -> bool {
    let marker_attributes = ["id", "name", "class"]
        .iter()
        .filter_map(|attribute| control.value().attr(attribute))
        .collect::<Vec<_>>();
    let marker = marker_attributes.iter().any(|value| {
        let tokens = value
            .split(|character: char| !character.is_ascii_alphanumeric())
            .map(str::to_ascii_lowercase)
            .collect::<Vec<_>>();
        tokens
            .iter()
            .any(|token| matches!(token.as_str(), "honeypot" | "honeytrap" | "spamtrap"))
            || value
                .chars()
                .filter(char::is_ascii_alphanumeric)
                .collect::<String>()
                .to_ascii_lowercase()
                .contains("botfield")
    });

    if marker {
        return true;
    }

    false
}

fn aria_hidden_value(value: Option<&str>) -> bool {
    value.is_some_and(|value| {
        matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "true" | "1" | "yes"
        )
    })
}

/// An element inside `aria-hidden` is only actionable when it is otherwise
/// focusable. Boolean `hidden`/`inert` and static visibility declarations make
/// the browser remove it from keyboard focus, so they are not accessibility
/// violations of the `aria-hidden` focus rule themselves.
fn focusability_blocked_by_markup(element: &ElementRef<'_>) -> bool {
    let blocked = |candidate: ElementRef<'_>| {
        let value = candidate.value();
        value.attr("hidden").is_some()
            || value.attr("inert").is_some()
            || value.attr("style").is_some_and(semantic_style_hides)
    };
    blocked(*element)
        || element
            .ancestors()
            .filter_map(ElementRef::wrap)
            .any(blocked)
}

fn style_hides_control(value: &str) -> bool {
    value.split(';').any(|declaration| {
        let Some((property, raw_value)) = declaration.split_once(':') else {
            return false;
        };
        let property = property.trim().to_ascii_lowercase();
        let value = raw_value
            .split_whitespace()
            .next()
            .unwrap_or_default()
            .trim_end_matches(';')
            .to_ascii_lowercase();
        let value = value.strip_suffix("!important").unwrap_or(&value);
        matches!(
            (property.as_str(), value),
            ("display", "none")
                | ("visibility", "hidden")
                | ("content-visibility", "hidden")
                | ("opacity", "0")
        ) || (property == "left" && value.starts_with('-'))
    })
}

fn is_hidden_conventional_anti_spam_field(control: &ElementRef<'_>) -> bool {
    let hidden_by_markup = |element: ElementRef<'_>| {
        let value = element.value();
        value.attr("hidden").is_some()
            || value.attr("inert").is_some()
            || aria_hidden_value(value.attr("aria-hidden"))
            || value.attr("style").is_some_and(style_hides_control)
    };
    let is_hidden = control
        .value()
        .attr("type")
        .is_some_and(|input_type| input_type.trim().eq_ignore_ascii_case("hidden"))
        || control
            .value()
            .attr("tabindex")
            .is_some_and(|value| value.trim() == "-1")
        || hidden_by_markup(*control)
        || control
            .ancestors()
            .filter_map(ElementRef::wrap)
            .any(hidden_by_markup);
    let conventional_honeypot_name = ["id", "name"]
        .iter()
        .filter_map(|attribute| control.value().attr(attribute))
        .any(|value| {
            let normalized = value
                .chars()
                .filter(|character| character.is_ascii_alphanumeric())
                .collect::<String>()
                .to_ascii_lowercase();
            matches!(
                normalized.as_str(),
                "website"
                    | "url"
                    | "websiteurl"
                    | "companywebsite"
                    | "companyurl"
                    | "yourwebsite"
                    | "homepage"
                    | "homepageurl"
            )
        });
    is_hidden && conventional_honeypot_name
}

fn accessibility_control_snippet(control: &ElementRef<'_>) -> String {
    accessibility_element_snippet(control)
}

fn accessibility_element_snippet(control: &ElementRef<'_>) -> String {
    const SAFE_ATTRIBUTES: &[&str] = &[
        "id",
        "lang",
        "type",
        "name",
        "autocomplete",
        "placeholder",
        "class",
        "href",
        "role",
        "alt",
        "src",
        "loading",
        "width",
        "height",
        "title",
        "aria-label",
        "aria-labelledby",
        "aria-describedby",
        "aria-controls",
        "aria-owns",
        "aria-flowto",
        "aria-details",
        "aria-errormessage",
        "aria-hidden",
        "aria-disabled",
        "tabindex",
        "contenteditable",
    ];
    const BOOLEAN_ATTRIBUTES: &[&str] =
        &["required", "disabled", "readonly", "multiple", "checked"];

    let mut snippet = format!("<{}", control.value().name());
    for (name, value) in control.value().attrs() {
        if SAFE_ATTRIBUTES.contains(&name) && !value.is_empty() {
            let safe_value = if matches!(name, "href" | "src") {
                value.split(['?', '#']).next().unwrap_or(value)
            } else {
                value
            };
            let escaped = safe_value
                .replace('&', "&amp;")
                .replace('"', "&quot;")
                .replace('<', "&lt;")
                .replace('>', "&gt;");
            snippet.push_str(&format!(" {name}=\"{escaped}\""));
        } else if BOOLEAN_ATTRIBUTES.contains(&name) {
            snippet.push_str(&format!(" {name}"));
        }
    }
    snippet.push('>');

    let mut bounded = snippet.chars().take(320).collect::<String>();
    if snippet.chars().count() > 320 {
        bounded.push('…');
    }
    bounded
}

fn is_structurally_valid_language_tag(value: &str) -> bool {
    let mut parts = value.split('-');
    let Some(primary) = parts.next() else {
        return false;
    };
    if primary.is_empty()
        || primary.len() > 8
        || !primary.bytes().all(|byte| byte.is_ascii_alphabetic())
    {
        return false;
    }
    if primary.len() == 1
        && !primary.eq_ignore_ascii_case("x")
        && !primary.eq_ignore_ascii_case("i")
    {
        return false;
    }
    let subtags = parts.collect::<Vec<_>>();
    if primary.len() == 1 && subtags.is_empty() {
        return false;
    }
    subtags.iter().all(|part| {
        !part.is_empty() && part.len() <= 8 && part.bytes().all(|byte| byte.is_ascii_alphanumeric())
    })
}

fn detect_html_technologies(
    document: &Html,
    html: &str,
    generator: Option<&str>,
) -> Vec<TechnologySignal> {
    let mut signals = Vec::new();
    let add = |name: &str,
               category: &str,
               evidence: String,
               confidence: &str,
               version: Option<String>,
               output: &mut Vec<TechnologySignal>| {
        if !output
            .iter()
            .any(|signal| signal.name == name && signal.category == category)
        {
            output.push(TechnologySignal {
                name: name.to_string(),
                category: category.to_string(),
                evidence,
                confidence: confidence.to_string(),
                version,
            });
        }
    };

    if let Some(value) = generator.filter(|value| !value.trim().is_empty()) {
        let value = value.trim();
        let known_generators = [
            ("WordPress", "WordPress"),
            ("Drupal", "Drupal"),
            ("Joomla!", "Joomla"),
            ("Joomla", "Joomla"),
            ("Ghost", "Ghost"),
            ("Shopify", "Shopify"),
            ("Wix", "Wix"),
            ("Squarespace", "Squarespace"),
            ("PrestaShop", "PrestaShop"),
            ("TYPO3", "TYPO3"),
        ];
        let declared = known_generators.iter().find(|(prefix, _)| {
            value
                .get(..prefix.len())
                .is_some_and(|candidate| candidate.eq_ignore_ascii_case(prefix))
                && value
                    .get(prefix.len()..)
                    .and_then(|remainder| remainder.chars().next())
                    .map_or(true, char::is_whitespace)
        });
        if let Some((_, name)) = declared {
            let (_, prefix) = declared.unwrap();
            let suffix = value.get(prefix.len()..).unwrap_or_default().trim_start();
            let version = parse_declared_version(suffix);
            add(
                name,
                "CMS / platform",
                format!("meta[name=generator] explicitly declares {value}"),
                "confirmed",
                version,
                &mut signals,
            );
        }
        add(
            "Generator declared by page",
            "CMS / generator",
            format!("meta[name=generator]: {value}"),
            "confirmed",
            None,
            &mut signals,
        );
    }

    let lower_html = html.to_ascii_lowercase();
    if !signals.iter().any(|signal| signal.name == "WordPress")
        && (lower_html.contains("/wp-content/") || lower_html.contains("/wp-includes/"))
    {
        add(
            "WordPress",
            "CMS",
            "HTML references /wp-content/ or /wp-includes/.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }
    if lower_html.contains("cdn.shopify.com") || lower_html.contains("shopify.theme") {
        add(
            "Shopify",
            "Commerce platform",
            "HTML contains a Shopify asset or runtime marker.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }
    if lower_html.contains("__next_data__") || lower_html.contains("/_next/") {
        add(
            "Next.js",
            "JavaScript framework",
            "HTML contains a Next.js document marker or asset path.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }
    if lower_html.contains("data-reactroot") || lower_html.contains("data-react-root") {
        add(
            "React",
            "JavaScript framework",
            "HTML contains a React root marker.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }
    if lower_html.contains("data-v-app") || lower_html.contains("__vue__") {
        add(
            "Vue.js",
            "JavaScript framework",
            "HTML contains a Vue application or component marker.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }
    let angular_selector =
        Selector::parse("[ng-version]").expect("static Angular version selector is valid");
    let angular_version = document
        .select(&angular_selector)
        .filter_map(|element| element.value().attr("ng-version"))
        .find_map(parse_declared_version);
    if lower_html.contains("_nghost-")
        || lower_html.contains("_ngcontent-")
        || angular_version.is_some()
    {
        add(
            "Angular",
            "JavaScript framework",
            if let Some(version) = angular_version.as_deref() {
                format!("ng-version explicitly declares Angular {version}.")
            } else {
                "HTML contains Angular host/content markers.".to_string()
            },
            if angular_version.is_some() {
                "confirmed"
            } else {
                "heuristic"
            },
            angular_version,
            &mut signals,
        );
    }
    if lower_html.contains("data-svelte-h") {
        add(
            "Svelte",
            "JavaScript framework",
            "HTML contains a Svelte hydration marker.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }
    if lower_html.contains("googletagmanager.com/gtm.js") || lower_html.contains("gtm-") {
        add(
            "Google Tag Manager",
            "Tag manager",
            "HTML contains a Google Tag Manager marker.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }
    if lower_html.contains("googletagmanager.com/gtag/js") || lower_html.contains("gtag(") {
        add(
            "Google tag",
            "Analytics / tag",
            "HTML contains a Google tag marker.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }

    let script_selector = Selector::parse("script[src]").expect("static script selector is valid");
    let script_sources = document
        .select(&script_selector)
        .filter_map(|script| script.value().attr("src"))
        .map(str::to_ascii_lowercase)
        .collect::<Vec<_>>();
    let stylesheet_selector = Selector::parse("link[href]").expect("static link selector is valid");
    let linked_assets = document
        .select(&stylesheet_selector)
        .filter_map(|link| link.value().attr("href"))
        .map(str::to_ascii_lowercase)
        .collect::<Vec<_>>();
    let asset_starts_with = |source: &str, marker: &str| {
        let path = source.split(['?', '#']).next().unwrap_or(source);
        let filename = path.rsplit('/').next().unwrap_or(path);
        filename == marker
            || filename.strip_prefix(marker).is_some_and(|suffix| {
                if suffix.starts_with('.') {
                    return true;
                }
                let mut characters = suffix.chars();
                matches!(characters.next(), Some('-' | '_' | '@'))
                    && characters
                        .next()
                        .is_some_and(|character| character.is_ascii_digit())
            })
    };
    if script_sources
        .iter()
        .any(|source| asset_starts_with(source, "jquery"))
    {
        add(
            "jQuery",
            "JavaScript library",
            "A script source explicitly references jQuery.".to_string(),
            "confirmed",
            None,
            &mut signals,
        );
    }
    if script_sources
        .iter()
        .any(|source| asset_starts_with(source, "alpinejs"))
        || lower_html.contains("x-data=")
    {
        add(
            "Alpine.js",
            "JavaScript framework",
            "HTML contains an Alpine.js asset or x-data directive.".to_string(),
            if script_sources
                .iter()
                .any(|source| asset_starts_with(source, "alpinejs"))
            {
                "confirmed"
            } else {
                "heuristic"
            },
            None,
            &mut signals,
        );
    }
    if script_sources
        .iter()
        .any(|source| asset_starts_with(source, "bootstrap"))
        || linked_assets
            .iter()
            .any(|asset| asset_starts_with(asset, "bootstrap"))
    {
        add(
            "Bootstrap",
            "CSS / UI framework",
            "A linked stylesheet or script explicitly references Bootstrap.".to_string(),
            "confirmed",
            None,
            &mut signals,
        );
    }
    if script_sources
        .iter()
        .any(|source| asset_starts_with(source, "tailwindcss"))
        || linked_assets
            .iter()
            .any(|asset| asset_starts_with(asset, "tailwindcss"))
    {
        add(
            "Tailwind CSS",
            "CSS / UI framework",
            "HTML contains a Tailwind CSS asset or runtime marker.".to_string(),
            "confirmed",
            None,
            &mut signals,
        );
    }
    if document.select(&script_selector).any(|script| {
        script
            .value()
            .attr("src")
            .is_some_and(|src| src.contains("plausible.io"))
    }) {
        add(
            "Plausible Analytics",
            "Analytics",
            "A script source references plausible.io.".to_string(),
            "confirmed",
            None,
            &mut signals,
        );
    }

    signals
}

fn parse_declared_version(value: &str) -> Option<String> {
    let value = value
        .strip_prefix('v')
        .or_else(|| value.strip_prefix('V'))
        .unwrap_or(value);
    let version: String = value
        .chars()
        .take_while(|character| character.is_ascii_digit() || *character == '.')
        .collect();
    let valid = !version.is_empty()
        && version
            .split('.')
            .all(|part| !part.is_empty() && part.parse::<u32>().is_ok())
        && value
            .chars()
            .nth(version.len())
            .map_or(true, char::is_whitespace);
    valid.then_some(version)
}

fn extract_structured_data(document: &Html) -> Vec<StructuredData> {
    let mut list = Vec::new();

    // JSON-LD
    let jsonld_selector = Selector::parse("script[type='application/ld+json']").unwrap();
    for el in document.select(&jsonld_selector) {
        let text = el.text().collect::<Vec<_>>().join("");
        match serde_json::from_str::<serde_json::Value>(&text) {
            Ok(json_val) => {
                let type_str = json_ld_type_summary(&json_val);
                let validation_issues = schema_validator::validate_jsonld(&json_val);
                list.push(StructuredData {
                    data_type: type_str,
                    format: "JSON-LD".to_string(),
                    content: json_val,
                    validation_issues,
                });
            }
            Err(error) => list.push(StructuredData {
                data_type: "Invalid JSON-LD block".to_string(),
                format: "JSON-LD".to_string(),
                content: serde_json::json!({ "parse_error": error.to_string() }),
                validation_issues: vec![crate::models::audit_data::StructuredDataValidationIssue {
                    code: "jsonld-syntax-invalid".into(),
                    severity: "error".into(),
                    message: format!("JSON-LD could not be parsed: {error}"),
                    path: None,
                    recommendation: Some(
                        "Fix the JSON syntax in this script[type=application/ld+json] block."
                            .into(),
                    ),
                }],
            }),
        }
    }

    // Microdata
    let microdata_selector = Selector::parse("[itemscope]").unwrap();
    for el in document.select(&microdata_selector) {
        let itemtype = el.value().attr("itemtype").map(str::trim);
        let itemprop_selector = Selector::parse("[itemprop]").unwrap();
        let itemprops = el
            .select(&itemprop_selector)
            .flat_map(|property| {
                property
                    .value()
                    .attr("itemprop")
                    .unwrap_or_default()
                    .split_ascii_whitespace()
            })
            .map(str::to_string)
            .collect::<Vec<_>>();
        let itemref = el
            .value()
            .attr("itemref")
            .unwrap_or_default()
            .split_ascii_whitespace()
            .map(str::to_string)
            .collect::<Vec<_>>();
        let content = serde_json::json!({
            "itemscope": true,
            "itemtype": itemtype,
            "itemid": el.value().attr("itemid"),
            "itemref": itemref,
            "itemprops": itemprops,
        });
        list.push(StructuredData {
            data_type: if itemtype.map_or(true, str::is_empty) {
                "Unknown Microdata item".into()
            } else {
                itemtype.unwrap().into()
            },
            format: "Microdata".to_string(),
            validation_issues: schema_validator::validate_microdata(&content),
            content,
        });
    }

    // RDFa: preserve only values explicitly declared on the element. This is
    // extraction, not a claim that the vocabulary is semantically valid.
    let rdfa_selector = Selector::parse(
        "[typeof], [property], [vocab], [rel], [rev], [datatype], [content], [prefix]",
    )
    .unwrap();
    for el in document.select(&rdfa_selector) {
        let typeof_value = el
            .value()
            .attr("typeof")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let property = el
            .value()
            .attr("property")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let vocab = el
            .value()
            .attr("vocab")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let rel = el
            .value()
            .attr("rel")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let rev = el
            .value()
            .attr("rev")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let datatype = el
            .value()
            .attr("datatype")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let content_value = el
            .value()
            .attr("content")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let prefix = el
            .value()
            .attr("prefix")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        // `rel` and `content` are common non-RDFa HTML attributes (for
        // example on link/meta elements). Keep the broader selector so their
        // values can be preserved when a real RDFa anchor is present, but do
        // not turn ordinary HTML into structured-data records.
        if typeof_value.is_none() && property.is_none() && vocab.is_none() {
            continue;
        }
        let data_type = typeof_value
            .map(str::to_string)
            .or_else(|| property.map(|value| format!("property: {value}")))
            .or_else(|| vocab.map(|value| format!("vocab: {value}")))
            .expect("RDFa selector guarantees at least one usable attribute");
        let content = serde_json::json!({
            "typeof": typeof_value,
            "property": property,
            "vocab": vocab,
            "about": el.value().attr("about"),
            "resource": el.value().attr("resource"),
            "rel": rel,
            "rev": rev,
            "datatype": datatype,
            "content": content_value,
            "prefix": prefix,
            "inlist": el.value().attr("inlist").is_some(),
        });
        list.push(StructuredData {
            data_type,
            format: "RDFa".to_string(),
            validation_issues: schema_validator::validate_rdfa(&content),
            content,
        });
    }

    list
}

fn json_ld_type_summary(value: &serde_json::Value) -> String {
    fn collect(value: &serde_json::Value, output: &mut Vec<String>) {
        match value {
            serde_json::Value::Object(object) => {
                if let Some(value) = object.get("@type") {
                    match value {
                        serde_json::Value::String(value) => output.push(value.clone()),
                        serde_json::Value::Array(values) => output.extend(
                            values
                                .iter()
                                .filter_map(|item| item.as_str().map(str::to_owned)),
                        ),
                        _ => {}
                    }
                }
                for (key, child) in object {
                    if key == "@graph" {
                        collect(child, output);
                    }
                }
            }
            serde_json::Value::Array(values) => {
                for item in values {
                    collect(item, output);
                }
            }
            _ => {}
        }
    }
    let mut types = Vec::new();
    collect(value, &mut types);
    types.sort();
    types.dedup();
    if types.is_empty() {
        "Unknown Schema".into()
    } else {
        types.join(", ")
    }
}

const MAX_STORED_BODY_TEXT_CHARS: usize = 200_000;

fn estimate_readability_syllables(word: &str) -> usize {
    let normalized = word.to_lowercase();
    let mut count = 0;
    let mut previous_vowel = false;
    for character in normalized.chars() {
        let vowel = matches!(
            character,
            'a' | 'e' | 'i' | 'o' | 'u' | 'y' | 'ą' | 'ę' | 'ó' | 'à' | 'è' | 'ì' | 'ò' | 'ù'
        );
        if vowel && !previous_vowel {
            count += 1;
        }
        previous_vowel = vowel;
    }
    if normalized.chars().count() > 2
        && normalized.ends_with('e')
        && count > 1
        && !normalized.ends_with("le")
    {
        count -= 1;
    }
    count.max(1)
}

fn readability_formula(
    language: Option<&str>,
    words: usize,
    sentences: usize,
    syllables: usize,
) -> (f32, f32, &'static str) {
    let language = language
        .and_then(|value| value.split(['-', '_']).next())
        .filter(|value| !value.is_empty());
    let words_per_sentence = words as f32 / sentences as f32;
    let syllables_per_word = syllables as f32 / words as f32;
    match language {
        Some("pl") => (
            (206.835 - 0.65 * words_per_sentence - 62.3 * syllables_per_word).clamp(0.0, 100.0),
            (0.4 * (words_per_sentence + 100.0 * syllables_per_word)).clamp(0.0, 100.0),
            "flesch-pl",
        ),
        Some("es") => (
            (206.84 - 1.02 * words_per_sentence - 60.0 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).max(0.0),
            "flesch-es",
        ),
        Some("fr") => (
            (207.0 - 1.015 * words_per_sentence - 73.6 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).max(0.0),
            "flesch-fr",
        ),
        Some("de") => (
            (180.0 - words_per_sentence - 58.5 * syllables_per_word).clamp(0.0, 100.0),
            (0.1935 * words_per_sentence + 0.1672 * syllables_per_word * 100.0).max(0.0),
            "flesch-de",
        ),
        Some("it") => (
            (206.835 - 1.015 * words_per_sentence - 84.6 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).max(0.0),
            "flesch-it",
        ),
        Some("pt") => (
            (248.835 - 1.015 * words_per_sentence - 84.6 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).max(0.0),
            "flesch-pt",
        ),
        Some("ru") => (
            (206.835 - 1.3 * words_per_sentence - 60.1 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).max(0.0),
            "flesch-ru",
        ),
        Some("en") | None => (
            (206.835 - 1.015 * words_per_sentence - 84.6 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).max(0.0),
            "flesch-en",
        ),
        _ => (
            (206.835 - 1.015 * words_per_sentence - 84.6 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).max(0.0),
            "flesch-like",
        ),
    }
}

/// Conservative fallback used only for selecting the local readability
/// heuristic when a document omits `html[lang]`. The persisted language field
/// remains empty unless the page explicitly declares it.
fn infer_content_language(text: &str) -> Option<&'static str> {
    const MARKERS: &[(&str, &[&str])] = &[
        ("en", &["the", "and", "with", "from", "this", "that"]),
        (
            "pl",
            &[
                "jest", "oraz", "się", "dla", "który", "które", "może", "mogą",
            ],
        ),
        ("de", &["und", "der", "die", "das", "mit", "nicht", "eine"]),
        (
            "es",
            &["que", "para", "con", "una", "los", "las", "del", "está"],
        ),
        ("fr", &["les", "des", "pour", "avec", "dans", "une", "est"]),
        ("it", &["gli", "che", "una", "per", "con", "sono", "della"]),
        ("pt", &["uma", "para", "com", "que", "dos", "das", "não"]),
        ("ru", &["это", "для", "что", "как", "или", "при", "есть"]),
    ];
    let mut scores = MARKERS
        .iter()
        .map(|(language, _)| (*language, 0usize))
        .collect::<Vec<_>>();
    for token in text
        .split(|character: char| !character.is_alphanumeric())
        .map(str::to_lowercase)
    {
        if token.is_empty() {
            continue;
        }
        for (index, (_, markers)) in MARKERS.iter().enumerate() {
            if markers.contains(&token.as_str()) {
                scores[index].1 += 1;
            }
        }
    }
    scores.sort_by_key(|left| std::cmp::Reverse(left.1));
    let best = scores.first()?;
    let second = scores.get(1).map(|entry| entry.1).unwrap_or(0);
    (best.1 >= 2 && best.1 > second).then_some(best.0)
}

fn semantic_content_root(element: &ElementRef<'_>) -> bool {
    let value = element.value();
    if matches!(value.name(), "main" | "article")
        || value
            .attr("role")
            .is_some_and(|role| role.eq_ignore_ascii_case("main"))
        || value
            .attr("itemprop")
            .is_some_and(|itemprop| itemprop.eq_ignore_ascii_case("articleBody"))
    {
        return true;
    }
    ["id", "class"].iter().any(|attribute| {
        value.attr(attribute).is_some_and(|value| {
            let compact = value
                .chars()
                .filter(|character| character.is_ascii_alphanumeric())
                .collect::<String>()
                .to_ascii_lowercase();
            ["maincontent", "articlebody", "postbody", "entrycontent"]
                .iter()
                .any(|marker| compact.contains(marker))
        })
    })
}

fn semantic_style_hides(value: &str) -> bool {
    value.split(';').any(|declaration| {
        let Some((property, raw_value)) = declaration.split_once(':') else {
            return false;
        };
        let property = property.trim().to_ascii_lowercase();
        let value = raw_value
            .split_whitespace()
            .next()
            .unwrap_or_default()
            .trim_end_matches(';')
            .to_ascii_lowercase();
        matches!(
            (property.as_str(), value.as_str()),
            ("display", "none") | ("visibility", "hidden") | ("content-visibility", "hidden")
        )
    })
}

fn semantic_chrome_element(element: &ElementRef<'_>) -> bool {
    let value = element.value();
    if matches!(value.name(), "header" | "nav" | "footer" | "aside" | "form")
        || value.attr("hidden").is_some()
        || value.attr("inert").is_some()
        || aria_hidden_value(value.attr("aria-hidden"))
        || value.attr("style").is_some_and(semantic_style_hides)
        || value.attr("role").is_some_and(|role| {
            [
                "banner",
                "navigation",
                "contentinfo",
                "complementary",
                "form",
                "search",
            ]
            .iter()
            .any(|candidate| role.eq_ignore_ascii_case(candidate))
        })
    {
        return true;
    }
    ["id", "class"].iter().any(|attribute| {
        value.attr(attribute).is_some_and(|value| {
            value
                .split(|character: char| !character.is_ascii_alphanumeric())
                .map(str::to_ascii_lowercase)
                .any(|token| {
                    [
                        "header",
                        "footer",
                        "sidebar",
                        "side",
                        "navigation",
                        "navbar",
                        "navmenu",
                        "menu",
                        "breadcrumb",
                        "cookie",
                        "consent",
                        "banner",
                    ]
                    .contains(&token.as_str())
                })
        })
    })
}

fn semantic_content_contains(element: &ElementRef<'_>, has_primary_root: bool) -> bool {
    if semantic_chrome_element(element) {
        return false;
    }
    let mut in_primary_root = semantic_content_root(element);
    for ancestor in element.ancestors().filter_map(ElementRef::wrap) {
        if semantic_chrome_element(&ancestor) {
            return false;
        }
        in_primary_root |= semantic_content_root(&ancestor);
    }
    !has_primary_root || in_primary_root
}

fn has_semantic_content_root(document: &Html) -> bool {
    document
        .root_element()
        .descendants()
        .filter_map(ElementRef::wrap)
        .filter(|element| !semantic_chrome_element(element))
        .any(|element| semantic_content_root(&element))
}

fn extract_content_stats(
    document: &Html,
    total_html_bytes: usize,
    language: Option<&str>,
) -> ContentStats {
    let body_selector = Selector::parse("body").unwrap();
    let body_el = match document.select(&body_selector).next() {
        Some(b) => b,
        None => return ContentStats::default(),
    };

    // Keep only visible text nodes from the semantic content region. Site
    // chrome (header/nav/footer/sidebar/form) must not influence SEO terms or
    // readability, while a document without a primary root conservatively
    // falls back to its body.
    let has_primary_root = has_semantic_content_root(document);
    let visible_text = body_el
        .descendants()
        .filter_map(|node| {
            let Node::Text(text) = node.value() else {
                return None;
            };
            let parent = node.parent().and_then(ElementRef::wrap)?;
            if !semantic_content_contains(&parent, has_primary_root)
                || matches!(
                    parent.value().name(),
                    "script" | "style" | "noscript" | "svg" | "template"
                )
                || parent
                    .ancestors()
                    .filter_map(ElementRef::wrap)
                    .any(|ancestor| {
                        matches!(
                            ancestor.value().name(),
                            "script" | "style" | "noscript" | "svg" | "template"
                        )
                    })
            {
                return None;
            }
            Some(text.text.as_ref())
        })
        .collect::<Vec<_>>()
        .join(" ");
    let full_text = visible_text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let effective_language = language.or_else(|| infer_content_language(&full_text));

    let mut words = Vec::new();
    for token in full_text.split_whitespace() {
        let clean: String = token
            .chars()
            .filter(|c| c.is_alphanumeric())
            .collect::<String>()
            .to_lowercase();
        if clean.len() >= 3 {
            words.push(clean);
        }
    }

    let word_count = words.len();
    let reading_time_minutes = if word_count == 0 {
        0
    } else {
        (word_count / 200).max(1)
    };
    let sentence_count = full_text
        .split(['.', '!', '?'])
        .filter(|sentence| sentence.chars().any(char::is_alphanumeric))
        .count();
    let average_words_per_sentence = if sentence_count == 0 {
        0.0
    } else {
        word_count as f32 / sentence_count as f32
    };
    let total_word_characters = words.iter().map(|word| word.chars().count()).sum::<usize>();
    let average_characters_per_word = if word_count == 0 {
        0.0
    } else {
        total_word_characters as f32 / word_count as f32
    };
    // A transparent, language-agnostic complexity heuristic. It only uses
    // sentence and token lengths; it is explicitly not Flesch, a grade level,
    // or a substitute for a linguistic readability assessment.
    let complexity_score = if word_count == 0 {
        0
    } else {
        (100.0
            - (average_words_per_sentence - 12.0).max(0.0) * 3.0
            - (average_characters_per_word - 5.0).max(0.0) * 8.0)
            .clamp(0.0, 100.0)
            .round() as u8
    };
    let complexity_label = if word_count == 0 {
        "unavailable"
    } else if complexity_score >= 75 {
        "simple"
    } else if complexity_score >= 45 {
        "moderate"
    } else {
        "complex"
    };

    let syllable_count = words
        .iter()
        .map(|word| estimate_readability_syllables(word))
        .sum::<usize>();
    let (readability_ease_score, readability_grade, readability_method) =
        if sentence_count == 0 || word_count == 0 {
            (0.0, 0.0, "unavailable")
        } else {
            readability_formula(
                effective_language,
                word_count,
                sentence_count,
                syllable_count,
            )
        };
    let readability_label = if word_count == 0 {
        "unavailable"
    } else if readability_ease_score >= 80.0 {
        "very-easy"
    } else if readability_ease_score >= 60.0 {
        "standard"
    } else if readability_ease_score >= 30.0 {
        "difficult"
    } else {
        "very-difficult"
    };

    // Text to HTML ratio
    let text_bytes = full_text.trim().len();
    let text_ratio_percent = if total_html_bytes > 0 {
        ((text_bytes as f32 / total_html_bytes as f32) * 100.0).min(100.0)
    } else {
        0.0
    };

    // Frequency analysis
    // Keep the frequency report useful for the locales supported by the UI.
    // This is intentionally a bounded, deterministic list rather than a
    // language-model or stemming step. Unknown/mixed-language pages still use
    // the existing English/Polish baseline and keep all other tokens visible.
    let stop_words = [
        "the",
        "and",
        "that",
        "have",
        "for",
        "not",
        "with",
        "you",
        "this",
        "but",
        "his",
        "from",
        "they",
        "say",
        "her",
        "she",
        "will",
        "one",
        "all",
        "would",
        "there",
        "their",
        "what",
        "out",
        "about",
        "who",
        "get",
        "which",
        "when",
        "make",
        "can",
        "like",
        "time",
        "just",
        "him",
        "know",
        "take",
        "people",
        "into",
        "year",
        "your",
        "good",
        "some",
        "could",
        "them",
        "see",
        "other",
        "than",
        "then",
        "now",
        "look",
        "only",
        "come",
        "its",
        "over",
        "think",
        "also",
        "back",
        "after",
        "use",
        "two",
        "how",
        "our",
        "work",
        "first",
        "well",
        "way",
        "even",
        "new",
        "want",
        "because",
        "any",
        "these",
        "give",
        "day",
        "most",
        "us",
        "oraz",
        "jest",
        "nie",
        "się",
        "na",
        "w",
        "z",
        "do",
        "dla",
        "to",
        "ten",
        "ta",
        "te",
        "że",
        "po",
        "od",
        "jak",
        "ale",
        "czy",
        "być",
        "aby",
        "przez",
        "przy",
        "który",
        "które",
        "których",
        "więcej",
        "czytaj",
        "twojej",
        "twoja",
        "naszej",
        // German
        "der",
        "die",
        "das",
        "und",
        "ist",
        "im",
        "in",
        "den",
        "dem",
        "des",
        "ein",
        "eine",
        "einer",
        "mit",
        "auf",
        "für",
        "nicht",
        "von",
        "zu",
        "als",
        "auch",
        // Spanish
        "el",
        "la",
        "los",
        "las",
        "del",
        "una",
        "un",
        "y",
        "es",
        "en",
        "para",
        "con",
        "por",
        "que",
        // French
        "le",
        "les",
        "du",
        "une",
        "et",
        "dans",
        "avec",
        "pas",
        "sur",
        "qui",
        // Italian
        "il",
        "lo",
        "gli",
        "e",
        "è",
        "non",
        "che",
        // Portuguese
        "o",
        "os",
        "as",
        "do",
        "da",
        "um",
        "uma",
        "em",
        "não",
        // Russian (common inflected function words are kept deliberately short)
        "и",
        "в",
        "во",
        "не",
        "что",
        "он",
        "на",
        "я",
        "с",
        "со",
        "как",
        "а",
        "то",
        "все",
        "она",
        "но",
        "да",
        "ты",
        "к",
        "у",
        "же",
        "вы",
        "за",
        "бы",
        "по",
        "только",
        "ее",
        "мне",
        "было",
        "вот",
        "от",
        "меня",
        "еще",
        "нет",
        "о",
        "из",
        "ему",
        "теперь",
        "когда",
        "даже",
        "ну",
        "вдруг",
        "ли",
        "если",
        "уже",
        "или",
        "ни",
        "быть",
        "был",
        "до",
        "вас",
        "опять",
        "вам",
        "ведь",
        "там",
        "потом",
        "себя",
        "ничего",
        "ей",
        "может",
        "они",
        "тут",
        "где",
        "есть",
        "надо",
        "для",
        "мы",
        "тебя",
        "их",
        "чем",
        "была",
        "сам",
        "тем",
        "чтобы",
    ];

    let mut freq_map: HashMap<String, usize> = HashMap::new();
    for w in &words {
        if !stop_words.contains(&w.as_str()) {
            *freq_map.entry(w.clone()).or_insert(0) += 1;
        }
    }

    let mut freq_vec: Vec<(String, usize)> = freq_map.into_iter().collect();
    freq_vec.sort_by_key(|a| std::cmp::Reverse(a.1));

    let top_keywords = freq_vec
        .into_iter()
        .take(10)
        .map(|(k, v)| KeywordStat {
            keyword: k,
            count: v,
            density_percent: if word_count == 0 {
                0.0
            } else {
                ((v as f32 / word_count as f32) * 10000.0).round() / 100.0
            },
        })
        .collect();

    let mut chars = full_text.chars();
    let body_text: String = chars.by_ref().take(MAX_STORED_BODY_TEXT_CHARS).collect();
    let body_text_truncated = chars.next().is_some();

    ContentStats {
        word_count,
        reading_time_minutes,
        text_ratio_percent,
        top_keywords,
        sentence_count,
        average_words_per_sentence,
        average_characters_per_word,
        complexity_score,
        complexity_label: complexity_label.to_string(),
        readability_ease_score,
        readability_grade,
        readability_method: readability_method.to_string(),
        readability_label: readability_label.to_string(),
        body_text,
        body_text_truncated,
    }
}

pub fn resolve_url(href: &str, base: Option<&Url>) -> String {
    if let Some(base_url) = base {
        if let Ok(joined) = base_url.join(href) {
            return joined.to_string();
        }
    }
    href.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

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
        ).unwrap();
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
        assert!(
            parsed
                .technical
                .technology_signals
                .iter()
                .any(|signal| signal.name == "Plausible Analytics"
                    && signal.confidence == "confirmed")
        );
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
                field.html_snippet.contains("type=\"text\"")
                    && !field.html_snippet.contains("secret-")
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
}
