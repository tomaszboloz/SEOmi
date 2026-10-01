const MAX_STORED_BODY_TEXT_CHARS: usize = 200_000;

use super::markup::{aria_hidden_value, semantic_style_hides};
use crate::models::audit_data::{ContentStats, KeywordStat};
use scraper::node::Node;
use scraper::{ElementRef, Html, Selector};
use std::collections::HashMap;

pub(super) fn estimate_readability_syllables(word: &str) -> usize {
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

pub(super) fn readability_formula(
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
pub(super) fn infer_content_language(text: &str) -> Option<&'static str> {
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

pub(super) fn semantic_content_root(element: &ElementRef<'_>) -> bool {
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

pub(super) fn semantic_chrome_element(element: &ElementRef<'_>) -> bool {
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

pub(super) fn semantic_content_contains(element: &ElementRef<'_>, has_primary_root: bool) -> bool {
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

pub(super) fn has_semantic_content_root(document: &Html) -> bool {
    document
        .root_element()
        .descendants()
        .filter_map(ElementRef::wrap)
        .filter(|element| !semantic_chrome_element(element))
        .any(|element| semantic_content_root(&element))
}

pub(super) fn extract_content_stats(
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
