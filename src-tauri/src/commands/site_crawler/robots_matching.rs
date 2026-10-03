use super::*;

pub(super) fn robots_deciding_rule<'a>(
    url: &url::Url,
    rules: &'a [RobotsRule],
) -> Option<&'a RobotsRule> {
    let requested = match url.query() {
        Some(query) => format!("{}?{}", url.path(), query),
        None => url.path().to_string(),
    };
    let mut best: Option<&RobotsRule> = None;
    for rule in rules {
        if robots_path_matches(&rule.path, &requested)
            && best
                .map(|current| {
                    robots_rule_specificity(&rule.path) > robots_rule_specificity(&current.path)
                        || (robots_rule_specificity(&rule.path)
                            == robots_rule_specificity(&current.path)
                            && rule.allow
                            && !current.allow)
                })
                .unwrap_or(true)
        {
            best = Some(rule);
        }
    }
    best
}

pub(super) fn robots_rule_specificity(pattern: &str) -> usize {
    pattern
        .trim_end_matches('$')
        .bytes()
        .filter(|byte| *byte != b'*')
        .count()
}

pub(super) fn robots_path_matches(pattern: &str, requested: &str) -> bool {
    let anchored = pattern.ends_with('$');
    let pattern = pattern.strip_suffix('$').unwrap_or(pattern);
    let pattern = percent_decode_robots_path(pattern);
    let requested = percent_decode_robots_path(requested);
    let regex_pattern = format!(
        "^{}{}",
        pattern
            .split('*')
            .map(regex::escape)
            .collect::<Vec<_>>()
            .join(".*"),
        if anchored { "$" } else { "" }
    );
    Regex::new(&regex_pattern)
        .map(|regex| regex.is_match(&requested))
        .unwrap_or(false)
}

/// Decode valid percent-encoded octets before matching robots paths. URL
/// parsers preserve escaped bytes in `Url::path()`, while robots rules are
/// commonly authored with either the escaped or human-readable spelling.
/// Invalid escapes are kept verbatim so malformed rules remain harmless and
/// deterministic instead of becoming a broader match.
pub(super) fn percent_decode_robots_path(value: &str) -> String {
    fn hex_digit(value: u8) -> Option<u8> {
        match value {
            b'0'..=b'9' => Some(value - b'0'),
            b'a'..=b'f' => Some(value - b'a' + 10),
            b'A'..=b'F' => Some(value - b'A' + 10),
            _ => None,
        }
    }

    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let (Some(high), Some(low)) =
                (hex_digit(bytes[index + 1]), hex_digit(bytes[index + 2]))
            {
                decoded.push((high << 4) | low);
                index += 3;
                continue;
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&decoded).into_owned()
}

pub(super) fn robots_allows(url: &url::Url, rules: &[RobotsRule]) -> bool {
    robots_deciding_rule(url, rules).map_or(true, |rule| rule.allow)
}
