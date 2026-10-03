use super::*;

pub(super) fn content_term_stats(
    document: &Html,
    language: Option<&str>,
) -> Vec<CrawledContentTerm> {
    const STOP_WORDS: &[&str] = &[
        "the", "and", "for", "with", "from", "that", "this", "your", "you", "are", "was", "have",
        "has", "will", "into", "about", "our", "their", "they", "what", "when", "where", "which",
        "who", "how", "can", "not", "but", "all", "one", "more", "use", "now", "get", "www",
        "http", "https", "oraz", "jest", "się", "dla", "nie", "jak", "który", "która", "które",
        "przez", "aby", "ten", "tej", "jego", "jej", "czy", "lub", "bez", "nad", "pod", "przy",
        "tym", "także", "może", "mogą", "und", "der", "die", "das", "ein", "eine", "ist", "für",
        "mit", "von", "den", "des", "los", "las", "una", "uno", "para", "por", "con", "que", "del",
        "est", "les", "une", "des", "pour", "avec", "dans", "est", "gli", "che", "una", "per",
        "con", "sono", "della", "uma", "para", "com", "que", "dos", "das", "uma", "как", "это",
        "для", "что", "как", "или", "при", "есть",
    ];
    let normalized_tokens = semantic_content_text(document)
        .split(|character: char| !character.is_alphanumeric())
        .map(str::to_lowercase)
        .collect::<Vec<_>>();
    let total = normalized_tokens.len() as f64;
    let tokens = normalized_tokens
        .into_iter()
        .filter(|token| {
            token.chars().count() >= 3
                && !STOP_WORDS.contains(&token.as_str())
                && !(normalized_language(language) == Some("pl")
                    && matches!(
                        token.as_str(),
                        "te" | "ta" | "to" | "na" | "do" | "od" | "po" | "za"
                            | "ze" | "we" | "w" | "z" | "i" | "że" | "ale"
                            | "więcej" | "czytaj" | "twojej"
                    ))
        })
        .collect::<Vec<_>>();
    if tokens.is_empty() {
        return Vec::new();
    }
    let mut frequencies = HashMap::<String, usize>::new();
    for token in tokens {
        *frequencies.entry(token).or_default() += 1;
    }
    let mut terms = frequencies.into_iter().collect::<Vec<_>>();
    terms.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
    terms
        .into_iter()
        .take(20)
        .map(|(term, count)| CrawledContentTerm {
            term,
            count,
            density_percent: count as f64 / total * 100.0,
        })
        .collect()
}

/// Conservative language inference used only when the page omits `html[lang]`.
/// It selects a heuristic but never invents the persisted document language.
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

pub(super) fn phrase_occurrences(text: &str, phrase: &str) -> usize {
    let normalized_phrase = phrase.trim().to_lowercase();
    if normalized_phrase.is_empty() {
        return 0;
    }
    text.to_lowercase()
        .match_indices(&normalized_phrase)
        .count()
}

pub(super) fn focus_phrase_evidence(
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
