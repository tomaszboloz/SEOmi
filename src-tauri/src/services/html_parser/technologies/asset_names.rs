pub(in crate::services::html_parser) fn asset_starts_with(source: &str, marker: &str) -> bool {
    let path = source.split(['?', '#']).next().unwrap_or(source);
    let filename = path.rsplit('/').next().unwrap_or(path);
    filename == marker
        || filename.strip_prefix(marker).is_some_and(|suffix| {
            if suffix.starts_with('.') {
                return true;
            }
            let mut characters = suffix.chars();
            matches!(characters.next(), Some('-' | '_' | '@'))
                && characters
                    .next()
                    .is_some_and(|character| character.is_ascii_digit())
        })
}

pub(in crate::services::html_parser) fn plausible_script_source(source: &str) -> bool {
    let source = if source.starts_with("//") {
        format!("https:{source}")
    } else {
        source.to_string()
    };
    url::Url::parse(&source).ok().is_some_and(|url| {
        matches!(url.scheme(), "http" | "https")
            && url
                .host_str()
                .is_some_and(|host| host == "plausible.io" || host.ends_with(".plausible.io"))
    })
}
