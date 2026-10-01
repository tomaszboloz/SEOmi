use super::*;

pub(super) fn is_valid_hreflang_code(value: &str) -> bool {
    if value.eq_ignore_ascii_case("x-default")
        || [
            "art-lojban",
            "cel-gaulish",
            "en-gb-oed",
            "i-ami",
            "i-bnn",
            "i-default",
            "i-enochian",
            "i-hak",
            "i-klingon",
            "i-lux",
            "i-mingo",
            "i-navajo",
            "i-pwn",
            "i-tao",
            "i-tay",
            "i-tsu",
            "no-bok",
            "no-nyn",
            "sgn-be-fr",
            "sgn-be-nl",
            "sgn-ch-de",
            "zh-guoyu",
            "zh-hakka",
            "zh-min",
            "zh-min-nan",
            "zh-xiang",
        ]
        .iter()
        .any(|tag| value.eq_ignore_ascii_case(tag))
    {
        return true;
    }

    let parts = value.split('-').collect::<Vec<_>>();
    if parts
        .iter()
        .any(|part| part.is_empty() || !part.bytes().all(|byte| byte.is_ascii_alphanumeric()))
    {
        return false;
    }

    let primary = parts[0];
    if !(2..=8).contains(&primary.len()) || !primary.bytes().all(|byte| byte.is_ascii_alphabetic())
    {
        return false;
    }

    let mut index = 1;
    if primary.len() <= 3 {
        let mut extlangs = 0;
        while index < parts.len()
            && extlangs < 3
            && parts[index].len() == 3
            && parts[index].bytes().all(|byte| byte.is_ascii_alphabetic())
        {
            index += 1;
            extlangs += 1;
        }
    }

    if index < parts.len()
        && parts[index].len() == 4
        && parts[index].bytes().all(|byte| byte.is_ascii_alphabetic())
    {
        index += 1;
    }
    if index < parts.len()
        && ((parts[index].len() == 2
            && parts[index].bytes().all(|byte| byte.is_ascii_alphabetic()))
            || (parts[index].len() == 3 && parts[index].bytes().all(|byte| byte.is_ascii_digit())))
    {
        index += 1;
    }

    let mut variants = HashSet::new();
    while index < parts.len() {
        let part = parts[index];
        let variant = (5..=8).contains(&part.len())
            || (part.len() == 4 && part.as_bytes()[0].is_ascii_digit());
        if !variant {
            break;
        }
        if !variants.insert(part.to_ascii_lowercase()) {
            return false;
        }
        index += 1;
    }

    let mut extensions = HashSet::new();
    while index < parts.len() && parts[index].len() == 1 && !parts[index].eq_ignore_ascii_case("x")
    {
        let singleton = parts[index].to_ascii_lowercase();
        if !extensions.insert(singleton) {
            return false;
        }
        index += 1;
        let start = index;
        while index < parts.len() && (2..=8).contains(&parts[index].len()) {
            index += 1;
        }
        if index == start {
            return false;
        }
    }

    if index < parts.len() && parts[index].eq_ignore_ascii_case("x") {
        index += 1;
        let start = index;
        while index < parts.len() && (1..=8).contains(&parts[index].len()) {
            index += 1;
        }
        if index == start {
            return false;
        }
    }

    index == parts.len()
}

pub(super) fn same_hreflang_url(left: &str, right: &str) -> bool {
    match (url::Url::parse(left), url::Url::parse(right)) {
        (Ok(mut left), Ok(mut right)) => {
            left.set_fragment(None);
            right.set_fragment(None);
            left == right
        }
        _ => false,
    }
}

pub(super) fn validate_hreflang_declarations(
    url: &str,
    final_url: &str,
    declarations: &[CrawledHreflang],
) -> Vec<CrawledPageIssue> {
    if declarations.is_empty() {
        return Vec::new();
    }
    let mut issues = Vec::new();
    let mut languages = HashSet::new();
    let mut x_default_count = 0;
    let has_self_reference = declarations.iter().any(|item| {
        same_hreflang_url(&item.target_url, url) || same_hreflang_url(&item.target_url, final_url)
    });

    for declaration in declarations {
        if !is_valid_hreflang_code(&declaration.language) {
            issues.push(CrawledPageIssue {
                severity: "Warning".into(),
                message: format!("Invalid hreflang language tag `{}`", declaration.language),
            });
        }
        let language = declaration.language.to_ascii_lowercase();
        if !languages.insert(language.clone()) {
            issues.push(CrawledPageIssue {
                severity: "Warning".into(),
                message: format!("Duplicate hreflang language tag `{}`", declaration.language),
            });
        }
        if language == "x-default" {
            x_default_count += 1;
        }
    }

    if !has_self_reference {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: "Hreflang cluster does not include a self-reference to this page".into(),
        });
    }
    if x_default_count == 0 {
        issues.push(CrawledPageIssue { severity: "Info".into(), message: "No x-default hreflang alternate is declared; add one when a language-neutral destination is available".into() });
    } else if x_default_count > 1 {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: "More than one x-default hreflang alternate is declared".into(),
        });
    }

    issues
}

pub(super) fn annotate_hreflang_target(
    source_url: &str,
    source_final_url: &str,
    target: &mut CrawledHreflang,
    crawled_statuses: &HashMap<String, u16>,
    hreflang_targets: &HashMap<String, HashSet<String>>,
    canonical_targets: &HashMap<String, Option<String>>,
) -> Vec<CrawledPageIssue> {
    let mut issues = Vec::new();
    let Some(status) = crawled_statuses.get(&target.target_url).copied() else {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: "Hreflang target was not included in this crawl; status and reciprocity were not verified".into(),
        });
        return issues;
    };
    target.target_http_status = Some(status);
    target.target_checked_in_run = true;
    if status == 0 || status >= 400 {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!("Hreflang target returned HTTP {status} in this crawl"),
        });
    }

    if let Some(reciprocal_targets) = hreflang_targets.get(&target.target_url) {
        let reciprocal = reciprocal_targets.contains(source_url)
            || reciprocal_targets.contains(source_final_url);
        target.reciprocal_in_run = Some(reciprocal);
        if !reciprocal {
            issues.push(CrawledPageIssue {
                severity: "Info".into(),
                message: "Hreflang target has no reciprocal reference in this crawl".into(),
            });
        }
    }

    if let Some(canonical) = canonical_targets.get(&target.target_url) {
        match canonical {
            Some(canonical) if same_hreflang_url(canonical, &target.target_url) => {
                target.target_canonical_alignment = Some("self-canonical".into());
            }
            Some(_) => {
                target.target_canonical_alignment = Some("canonical-points-elsewhere".into());
                issues.push(CrawledPageIssue {
                    severity: "Info".into(),
                    message: "Hreflang target canonical points to another URL".into(),
                });
            }
            None => {
                target.target_canonical_alignment = Some("missing-canonical".into());
                issues.push(CrawledPageIssue {
                    severity: "Info".into(),
                    message: "Hreflang target has no canonical declaration; alignment could not be checked".into(),
                });
            }
        }
    }
    issues
}
