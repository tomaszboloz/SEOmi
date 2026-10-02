pub(in crate::services::html_parser) fn content_words(full_text: &str) -> Vec<String> {
    let mut words = Vec::new();
    for token in full_text.split_whitespace() {
        let clean: String = token
            .chars()
            .filter(|c| c.is_alphanumeric())
            .collect::<String>()
            .to_lowercase();
        if clean.len() >= 3 {
            words.push(clean);
        }
    }
    words
}
