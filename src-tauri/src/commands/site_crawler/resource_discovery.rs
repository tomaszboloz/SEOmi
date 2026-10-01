use super::*;

pub(super) fn add_resource_candidate(
    candidates: &mut HashMap<String, ResourceCandidate>,
    source_url: &str,
    base: &url::Url,
    href: &str,
    resource_type: &str,
    base_host: &str,
    config: &CrawlConfig,
) {
    if !resource_type_enabled(resource_type, config) {
        return;
    }
    let Ok(resolved) = base.join(href) else {
        return;
    };
    let Ok(validated) = validate_and_normalize_url(resolved.as_str()) else {
        return;
    };
    if !matches_scope(
        &validated,
        base_host,
        config.allow_subdomains,
        config.scope_path.as_deref(),
        &config.allowed_hosts,
    ) {
        return;
    }
    let url = normalize_crawl_url(validated, config).to_string();
    if !candidates.contains_key(&url) && candidates.len() >= MAX_RESOURCE_DISCOVERY_CANDIDATES {
        return;
    }
    let candidate = candidates
        .entry(url.clone())
        .or_insert_with(|| ResourceCandidate {
            source_urls: Vec::new(),
            url,
            resource_type: resource_type.into(),
        });
    if candidate.source_urls.len() < 100
        && !candidate
            .source_urls
            .iter()
            .any(|value| value == source_url)
    {
        candidate.source_urls.push(source_url.to_owned());
    }
}

pub(super) fn is_other_resource_url(url: &url::Url) -> bool {
    let path = url.path().to_ascii_lowercase();
    [
        ".pdf", ".xml", ".json", ".zip", ".csv", ".txt", ".woff", ".woff2", ".ttf", ".otf", ".mp4",
        ".webm", ".mp3", ".wav",
    ]
    .iter()
    .any(|extension| path.ends_with(extension))
}

pub(super) const MAX_FILTER_PATTERNS: usize = 100;
pub(super) const MAX_FILTER_PATTERN_LENGTH: usize = 2_048;
pub(super) const MAX_FILTER_PREVIEW_URLS: usize = 500;

pub(super) fn compile_filter_patterns(
    patterns: &[String],
    filter: &str,
) -> Result<Vec<Regex>, CrawlFilterValidationError> {
    if patterns.len() > MAX_FILTER_PATTERNS {
        return Err(CrawlFilterValidationError {
            filter: filter.into(),
            pattern: String::new(),
            message: format!("A maximum of {MAX_FILTER_PATTERNS} patterns is allowed."),
        });
    }

    patterns
        .iter()
        .map(|pattern| {
            if pattern.chars().count() > MAX_FILTER_PATTERN_LENGTH {
                return Err(CrawlFilterValidationError {
                    filter: filter.into(),
                    pattern: pattern.clone(),
                    message: format!(
                        "Pattern is longer than {MAX_FILTER_PATTERN_LENGTH} characters."
                    ),
                });
            }
            Regex::new(pattern).map_err(|error| CrawlFilterValidationError {
                filter: filter.into(),
                pattern: pattern.clone(),
                message: error.to_string(),
            })
        })
        .collect()
}

pub(super) fn filter_preview(
    url: String,
    include: &[Regex],
    exclude: &[Regex],
) -> CrawlFilterPreview {
    let included_by_include =
        include.is_empty() || include.iter().any(|pattern| pattern.is_match(&url));
    let excluded_by_exclude = exclude.iter().any(|pattern| pattern.is_match(&url));
    let (included, reason) = if !included_by_include {
        (false, "Does not match any include pattern".into())
    } else if excluded_by_exclude {
        (false, "Matches an exclude pattern".into())
    } else {
        (true, "Accepted by the configured filters".into())
    };
    CrawlFilterPreview {
        url,
        included,
        reason,
    }
}

#[tauri::command]
pub fn validate_crawl_filters(
    include_patterns: Vec<String>,
    exclude_patterns: Vec<String>,
    preview_urls: Vec<String>,
) -> CrawlFilterValidationResult {
    let include = compile_filter_patterns(&include_patterns, "include");
    let exclude = compile_filter_patterns(&exclude_patterns, "exclude");
    let mut errors = Vec::new();
    if let Err(error) = &include {
        errors.push(error.clone());
    }
    if let Err(error) = &exclude {
        errors.push(error.clone());
    }
    if !errors.is_empty() {
        return CrawlFilterValidationResult {
            valid: false,
            errors,
            previews: Vec::new(),
        };
    }

    let include = include.expect("validated include patterns");
    let exclude = exclude.expect("validated exclude patterns");
    let previews = preview_urls
        .into_iter()
        .filter(|url| !url.trim().is_empty())
        .take(MAX_FILTER_PREVIEW_URLS)
        .map(|url| filter_preview(url, &include, &exclude))
        .collect();
    CrawlFilterValidationResult {
        valid: true,
        errors: Vec::new(),
        previews,
    }
}
