use scraper::ElementRef;

/// Text under these elements is code or hidden data, never anchor context (#70 GEM-70-07).
pub(crate) fn is_hidden_text(parent: Option<ElementRef<'_>>) -> bool {
    parent.is_some_and(|parent| {
        std::iter::once(parent)
            .chain(parent.ancestors().filter_map(ElementRef::wrap))
            .any(|ancestor| {
                matches!(
                    ancestor.value().name(),
                    "script" | "style" | "noscript" | "template" | "svg" | "textarea"
                )
            })
    })
}

/// Replaces e-mail addresses, long digit runs and token-like strings so context
/// stays evidence about placement, not a copy of personal or secret data.
pub(crate) fn redact_context_word(word: &str) -> String {
    let core = word.trim_matches(|c: char| !c.is_alphanumeric() && c != '@');
    let digits = core.chars().filter(char::is_ascii_digit).count();
    let letters = core.chars().filter(|c| c.is_ascii_alphabetic()).count();
    if core.contains('@') && core.contains('.') {
        "[email]".to_owned()
    } else if digits >= 9 && digits * 2 >= core.chars().count() {
        "[number]".to_owned()
    } else if core.len() >= 24 && digits > 0 && letters > 0 && !core.contains(char::is_whitespace) {
        "[token]".to_owned()
    } else {
        word.to_owned()
    }
}
