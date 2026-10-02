use super::*;

pub(in crate::commands::site_crawler) fn robots_deciding_rule<'a>(
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

pub(in crate::commands::site_crawler) fn robots_rule_specificity(pattern: &str) -> usize {
    pattern
        .trim_end_matches('$')
        .bytes()
        .filter(|byte| *byte != b'*')
        .count()
}

pub(in crate::commands::site_crawler) fn robots_path_matches(
    pattern: &str,
    requested: &str,
) -> bool {
    let anchored = pattern.ends_with('$');
    let pattern = pattern.strip_suffix('$').unwrap_or(pattern);
    let mut pattern = percent_decode_robots_path(pattern).into_bytes();
    // Without the end anchor a rule is a prefix: it may be followed by anything.
    if !anchored {
        pattern.push(b'*');
    }
    wildcard_matches(&pattern, percent_decode_robots_path(requested).as_bytes())
}

/// `*` matches any byte sequence; every other byte matches itself. Iterative
/// backtracking to the last `*` keeps this allocation-free and, unlike a
/// compiled regex, it cannot fail on a long rule and silently ignore it.
fn wildcard_matches(pattern: &[u8], text: &[u8]) -> bool {
    let (mut p, mut t) = (0, 0);
    let mut last_star: Option<(usize, usize)> = None;
    while t < text.len() {
        if p < pattern.len() && pattern[p] == b'*' {
            last_star = Some((p, t));
            p += 1;
        } else if p < pattern.len() && pattern[p] == text[t] {
            p += 1;
            t += 1;
        } else if let Some((star, matched)) = last_star {
            p = star + 1;
            t = matched + 1;
            last_star = Some((star, matched + 1));
        } else {
            return false;
        }
    }
    pattern[p..].iter().all(|byte| *byte == b'*')
}

/// Decode valid percent-encoded octets before matching robots paths. URL
/// parsers preserve escaped bytes in `Url::path()`, while robots rules are
/// commonly authored with either the escaped or human-readable spelling.
/// Invalid escapes are kept verbatim so malformed rules remain harmless and
/// deterministic instead of becoming a broader match.
pub(in crate::commands::site_crawler) fn percent_decode_robots_path(value: &str) -> String {
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

pub(in crate::commands::site_crawler) fn robots_allows(
    url: &url::Url,
    rules: &[RobotsRule],
) -> bool {
    robots_deciding_rule(url, rules).map_or(true, |rule| rule.allow)
}
