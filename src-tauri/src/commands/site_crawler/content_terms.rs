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
                        "te" | "ta"
                            | "to"
                            | "na"
                            | "do"
                            | "od"
                            | "po"
                            | "za"
                            | "ze"
                            | "we"
                            | "w"
                            | "z"
                            | "i"
                            | "że"
                            | "ale"
                            | "więcej"
                            | "czytaj"
                            | "twojej"
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

#[path = "content_phrase.rs"]
mod phrase;
pub(super) use phrase::*;
