use super::semantic_inflection::{focus_language_stopword, fold_semantic_text};
use super::semantic_terms::semantic_token;
use super::*;

const MAX_FOCUS_TERMS: usize = 120;
pub(super) const STRONG_ZONE_WEIGHT: f32 = 2.5;
const MAX_NGRAM: usize = 4;
const SEGMENT_BREAKS: &str = ".,;:!?()[]{}|\"\u{2026}\u{ab}\u{bb}\u{201e}\u{201c}\u{201d}\n";

#[derive(Default)]
struct Entry {
    count: u32,
    weight: f32,
    forms: HashMap<String, u32>,
}

pub(super) struct FocusCounter<'a> {
    language: Option<&'a str>,
    entries: HashMap<String, Entry>,
}

impl<'a> FocusCounter<'a> {
    pub(super) fn new(language: Option<&'a str>) -> Self {
        Self {
            language,
            entries: HashMap::new(),
        }
    }

    /// Adds every 1..=4-gram of `text`. `weight` is the zone multiplier;
    /// `counted` is false for extra weight on text already counted as body.
    pub(super) fn observe(&mut self, text: &str, weight: f32, counted: bool) {
        for segment in text.split(|character| SEGMENT_BREAKS.contains(character)) {
            let mut run: Vec<(String, String)> = Vec::new();
            let tokens = segment.split(|character: char| !character.is_alphanumeric());
            for token in tokens.chain(std::iter::once("")) {
                match semantic_token(token, self.language).filter(|(_, form)| {
                    !focus_language_stopword(&fold_semantic_text(form), self.language)
                }) {
                    Some(pair) => run.push(pair),
                    None => {
                        self.add_run(&run, weight, counted);
                        run.clear();
                    }
                }
            }
        }
    }

    fn add_run(&mut self, run: &[(String, String)], weight: f32, counted: bool) {
        for start in 0..run.len() {
            for end in (start + 1)..=run.len().min(start + MAX_NGRAM) {
                let part = &run[start..end];
                let key = part
                    .iter()
                    .map(|p| p.0.as_str())
                    .collect::<Vec<_>>()
                    .join(" ");
                let form = part
                    .iter()
                    .map(|p| p.1.as_str())
                    .collect::<Vec<_>>()
                    .join(" ");
                let entry = self.entries.entry(key).or_default();
                entry.weight += weight;
                if counted {
                    entry.count += 1;
                    *entry.forms.entry(form).or_default() += 1;
                }
            }
        }
    }

    pub(super) fn into_terms(self) -> Vec<FocusTerm> {
        let mut terms = self
            .entries
            .into_iter()
            .filter(|(key, entry)| {
                // Repeated or emphasised phrases only: one-off n-grams are noise.
                !key.contains(' ') || entry.count >= 2 || entry.weight >= STRONG_ZONE_WEIGHT
            })
            .map(|(term, entry)| {
                let surface = entry
                    .forms
                    .into_iter()
                    .max_by(|a, b| a.1.cmp(&b.1).then_with(|| b.0.cmp(&a.0)))
                    .map_or_else(|| term.clone(), |form| form.0);
                let weight = (entry.weight * 100.0).round() / 100.0;
                FocusTerm {
                    term,
                    surface,
                    count: entry.count,
                    weight,
                }
            })
            .collect::<Vec<_>>();
        terms.sort_by(|a, b| {
            b.weight
                .total_cmp(&a.weight)
                .then_with(|| a.term.cmp(&b.term))
        });
        terms.truncate(MAX_FOCUS_TERMS);
        terms
    }
}
