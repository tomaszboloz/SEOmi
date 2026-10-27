use super::*;

#[test]
fn readability_formula_selects_supported_locale_coefficients() {
    let spanish = readability_formula(Some("es-MX"), 40, 2, 70);
    let french = readability_formula(Some("fr_FR"), 40, 2, 70);

    assert_eq!(spanish.2, "flesch-es");
    assert_eq!(french.2, "flesch-fr");
    for (ease, grade, _) in [spanish, french] {
        assert!(ease.is_finite() && (0.0..=100.0).contains(&ease));
        assert!(grade.is_finite() && (0.0..=100.0).contains(&grade));
    }
}

#[test]
fn readability_formula_uses_explicit_fallback_for_unknown_languages() {
    let fallback = readability_formula(Some("de-DE"), 10, 2, 10);

    assert_eq!(fallback.2, "flesch-like");
    assert!(fallback.0.is_finite() && (0.0..=100.0).contains(&fallback.0));
    assert!(fallback.1.is_finite() && fallback.1 >= 0.0);
    assert_eq!(normalized_language(Some("de-DE")), Some("de"));
    assert_eq!(normalized_language(Some("_de")), None);
    assert_eq!(normalized_language(Some("")), None);
    assert_eq!(normalized_language(None), None);
}

#[test]
fn readability_labels_keep_all_score_boundaries_stable() {
    assert_eq!(readability_label(80.0), "very-easy");
    assert_eq!(readability_label(60.0), "standard");
    assert_eq!(readability_label(30.0), "difficult");
    assert_eq!(readability_label(29.99), "very-difficult");
}

#[test]
fn syllable_estimation_handles_silent_e_le_and_unicode_vowels() {
    assert_eq!(estimate_syllables("make"), 1);
    assert_eq!(estimate_syllables("table"), 2);
    assert_eq!(estimate_syllables("ŁÓDŹ"), 1);
    assert_eq!(estimate_syllables("rhythm"), 1);
    assert_eq!(estimate_syllables(""), 1);
}
