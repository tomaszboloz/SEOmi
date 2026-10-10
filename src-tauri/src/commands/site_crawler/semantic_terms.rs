use super::semantic_inflection::{fold_semantic_text, semantic_noise_token, semantic_term_key};
use super::*;

/// Redirects and error pages describe the response, not a topic of the site.
/// Rendered crawls report 0 when the browser did not expose the HTTP status.
pub(super) fn semantic_status_is_topical(status: u16) -> bool {
    status == 0 || (200..300).contains(&status)
}

/// Language for grouping semantic terms: the declared `html[lang]`, or the
/// conservative content inference when the page declares none.
pub(super) fn semantic_term_language(document: &Html, declared: Option<&str>) -> Option<String> {
    normalized_language(declared)
        .map(str::to_ascii_lowercase)
        .or_else(|| infer_content_language(&semantic_content_text(document)).map(str::to_owned))
}

/// Term frequencies of one page. Inflected forms share one entry:
/// (total count, count per surface form).
pub(super) struct SemanticTermGroups<'a> {
    language: Option<&'a str>,
    groups: HashMap<String, (usize, HashMap<String, usize>)>,
}

impl<'a> SemanticTermGroups<'a> {
    /// `language` is the resolved grouping language (see `semantic_term_language`).
    pub(super) fn new(language: Option<&'a str>) -> Self {
        Self {
            language,
            groups: HashMap::new(),
        }
    }

    pub(super) fn observe(&mut self, token: &str) {
        let token = token.trim();
        let char_count = token.chars().count();
        // Two-letter tokens are almost always function words; keep them
        // only as uppercase acronyms such as AI, HR or PR.
        let acronym = char_count == 2 && token.chars().all(|character| character.is_uppercase());
        if char_count < 3 && !acronym {
            return;
        }
        let normalized = token.to_lowercase();
        if semantic_noise_token(&fold_semantic_text(&normalized)) {
            return;
        }
        let group = self
            .groups
            .entry(semantic_term_key(&normalized, self.language))
            .or_default();
        group.0 += 1;
        *group.1.entry(normalized).or_default() += 1;
    }

    /// Most frequent terms first, each reported in the form the page uses
    /// most; ties prefer the shorter form.
    pub(super) fn into_terms(self, limit: usize) -> Vec<String> {
        let mut terms = self
            .groups
            .into_values()
            .filter_map(|(count, forms)| {
                let surface = forms
                    .into_iter()
                    .max_by(|left, right| {
                        left.1
                            .cmp(&right.1)
                            .then_with(|| right.0.chars().count().cmp(&left.0.chars().count()))
                            .then_with(|| right.0.cmp(&left.0))
                    })?
                    .0;
                Some((surface, count))
            })
            .collect::<Vec<_>>();
        terms.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
        terms
            .into_iter()
            .take(limit)
            .map(|(term, _)| term)
            .collect()
    }
}
