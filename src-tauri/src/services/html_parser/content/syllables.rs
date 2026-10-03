pub(in crate::services::html_parser) fn estimate_readability_syllables(word: &str) -> usize {
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
