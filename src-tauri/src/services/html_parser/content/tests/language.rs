use super::*;

#[test]
fn syllable_estimator_preserves_unicode_vowel_groups_and_minimum_one() {
    for (word, expected) in [
        ("", 1),
        ("rhythm", 1),
        ("road", 1),
        ("cache", 1),
        ("table", 2),
        ("ĄĘÓ", 1),
        ("banana", 3),
    ] {
        assert_eq!(estimate_readability_syllables(word), expected, "{word}");
    }
}

#[test]
fn fallback_language_requires_unique_repeated_markers() {
    for (text, expected) in [
        ("the and this", "en"),
        ("jest oraz się", "pl"),
        ("und der die", "de"),
        ("los las del", "es"),
        ("les des pour", "fr"),
        ("gli sono della", "it"),
        ("uma com não", "pt"),
        ("это что как", "ru"),
    ] {
        assert_eq!(infer_content_language(text), Some(expected), "{text}");
    }
    for text in ["", "keyword", "the", "the and jest oraz", "!? ..."] {
        assert_eq!(infer_content_language(text), None, "{text}");
    }
}

#[test]
fn all_supported_formulas_are_bounded_and_unknown_languages_are_explicit() {
    for (language, method) in [
        ("pl", "flesch-pl"),
        ("es", "flesch-es"),
        ("fr", "flesch-fr"),
        ("de", "flesch-de"),
        ("it", "flesch-it"),
        ("pt", "flesch-pt"),
        ("ru", "flesch-ru"),
        ("en", "flesch-en"),
        ("unknown", "flesch-like"),
    ] {
        let (ease, grade, actual) = readability_formula(Some(language), 10, 2, 100);
        assert_eq!(actual, method);
        assert!((0.0..=100.0).contains(&ease));
        assert!(grade.is_finite() && grade >= 0.0);
    }
    assert_eq!(readability_formula(None, 10, 2, 10).2, "flesch-en");
    assert_eq!(readability_formula(Some(" "), 10, 2, 10).2, "flesch-en");
    assert_eq!(readability_formula(Some("PL_pl"), 10, 2, 10).2, "flesch-pl");
}

#[test]
fn stop_word_lookup_keeps_supported_function_words_and_preserves_other_words() {
    for word in ["the", "oraz", "für", "que", "avec", "gli", "não", "чтобы"] {
        assert!(is_stop_word(word), "{word}");
    }
    for word in ["seomi", "article", "brand", "未知", "THE"] {
        assert!(!is_stop_word(word), "{word}");
    }
}
