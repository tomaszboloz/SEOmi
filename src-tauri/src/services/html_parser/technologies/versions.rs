pub(in crate::services::html_parser) fn parse_declared_version(value: &str) -> Option<String> {
    let value = value
        .strip_prefix('v')
        .or_else(|| value.strip_prefix('V'))
        .unwrap_or(value);
    let version: String = value
        .chars()
        .take_while(|character| character.is_ascii_digit() || *character == '.')
        .collect();
    let valid = !version.is_empty()
        && version
            .split('.')
            .all(|part| !part.is_empty() && part.parse::<u32>().is_ok())
        && value
            .chars()
            .nth(version.len())
            .map_or(true, char::is_whitespace);
    valid.then_some(version)
}
