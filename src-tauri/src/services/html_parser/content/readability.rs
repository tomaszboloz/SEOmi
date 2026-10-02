pub(in crate::services::html_parser) fn readability_formula(
    language: Option<&str>,
    words: usize,
    sentences: usize,
    syllables: usize,
) -> (f32, f32, &'static str) {
    if words == 0 || sentences == 0 {
        return (0.0, 0.0, "unavailable");
    }
    let language = language
        .map(str::trim)
        .and_then(|value| value.split(['-', '_']).next())
        .filter(|value| !value.is_empty())
        .map(str::to_ascii_lowercase);
    let words_per_sentence = words as f32 / sentences as f32;
    let syllables_per_word = syllables as f32 / words as f32;
    match language.as_deref() {
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
