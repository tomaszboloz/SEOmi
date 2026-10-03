use super::*;

/// Conservative language inference used only when the page omits `html[lang]`.
/// It selects a heuristic but never invents the persisted document language.
pub(in crate::commands::site_crawler) fn infer_content_language(
    text: &str,
) -> Option<&'static str> {
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

pub(in crate::commands::site_crawler) fn phrase_occurrences(text: &str, phrase: &str) -> usize {
    let normalized_phrase = phrase.trim().to_lowercase();
    if normalized_phrase.is_empty() {
        return 0;
    }
    text.to_lowercase()
        .match_indices(&normalized_phrase)
        .count()
}

pub(in crate::commands::site_crawler) fn focus_phrase_evidence(
    document: &Html,
    title: Option<&str>,
    meta_description: Option<&str>,
    phrase: Option<&str>,
) -> Option<CrawledFocusPhraseEvidence> {
    let phrase = phrase?.trim();
    if phrase.is_empty() {
        return None;
    }
    let body = semantic_content_text(document);
    let body_occurrences = phrase_occurrences(&body, phrase);
    let token_count = body.split_whitespace().count();
    let title_occurrences = phrase_occurrences(title.unwrap_or_default(), phrase);
    let meta_description_occurrences =
        phrase_occurrences(meta_description.unwrap_or_default(), phrase);
    let h1_selector = Selector::parse("h1").expect("static h1 selector is valid");
    let h1_text = document
        .select(&h1_selector)
        .map(|element| element.text().collect::<Vec<_>>().join(" "))
        .collect::<Vec<_>>()
        .join(" ");
    Some(CrawledFocusPhraseEvidence {
        phrase: phrase.to_string(),
        body_occurrences,
        body_density_percent: if token_count == 0 {
            0.0
        } else {
            body_occurrences as f64 / token_count as f64 * 100.0
        },
        title_occurrences,
        meta_description_occurrences,
        h1_occurrences: phrase_occurrences(&h1_text, phrase),
    })
}
