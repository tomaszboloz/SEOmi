pub(in crate::services::html_parser) fn is_structurally_valid_language_tag(value: &str) -> bool {
    let mut parts = value.split('-');
    let primary = parts.next().unwrap_or_default();
    if primary.is_empty()
        || primary.len() > 8
        || !primary.bytes().all(|byte| byte.is_ascii_alphabetic())
    {
        return false;
    }
    if primary.len() == 1
        && !primary.eq_ignore_ascii_case("x")
        && !primary.eq_ignore_ascii_case("i")
    {
        return false;
    }
    let subtags = parts.collect::<Vec<_>>();
    if primary.len() == 1 && subtags.is_empty() {
        return false;
    }
    subtags.iter().all(|part| {
        !part.is_empty() && part.len() <= 8 && part.bytes().all(|byte| byte.is_ascii_alphanumeric())
    })
}
