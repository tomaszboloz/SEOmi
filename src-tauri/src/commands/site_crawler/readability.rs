pub(super) fn estimate_syllables(word: &str) -> usize {
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

pub(super) fn readability_label(score: f64) -> String {
    if score >= 80.0 {
        "very-easy".into()
    } else if score >= 60.0 {
        "standard".into()
    } else if score >= 30.0 {
        "difficult".into()
    } else {
        "very-difficult".into()
    }
}

pub(super) fn normalized_language(language: Option<&str>) -> Option<&str> {
    language
        .and_then(|value| value.split(['-', '_']).next())
        .filter(|value| !value.is_empty())
}

pub(super) fn readability_formula(
    language: Option<&str>,
    words: usize,
    sentences: usize,
    syllables: usize,
) -> (f64, f64, &'static str) {
    let words_per_sentence = words as f64 / sentences as f64;
    let syllables_per_word = syllables as f64 / words as f64;
    match normalized_language(language) {
        // Adapted Flesch for Polish (Pisarek/Król). Polish syllable density
        // is higher than English, so its coefficient is intentionally lower.
        Some("pl") => (
            (206.835 - 0.65 * words_per_sentence - 62.3 * syllables_per_word).clamp(0.0, 100.0),
            (0.4 * (words_per_sentence + 100.0 * syllables_per_word)).clamp(0.0, 100.0),
            "flesch-pl",
        ),
        Some("es") => (
            (206.84 - 1.02 * words_per_sentence - 60.0 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).clamp(0.0, 100.0),
            "flesch-es",
        ),
        Some("fr") => (
            (207.0 - 1.015 * words_per_sentence - 73.6 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).clamp(0.0, 100.0),
            "flesch-fr",
        ),
        Some("en") | None => (
            (206.835 - 1.015 * words_per_sentence - 84.6 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).clamp(0.0, 100.0),
            "flesch-en",
        ),
        _ => (
            (206.835 - 1.015 * words_per_sentence - 84.6 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).max(0.0),
            "flesch-like",
        ),
    }
}
