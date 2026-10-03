use super::*;

pub(in crate::services::html_parser) fn is_stop_word(word: &str) -> bool {
    stop_words_baseline::WORDS.contains(&word)
        || stop_words_european::WORDS.contains(&word)
        || stop_words_russian::WORDS.contains(&word)
}
