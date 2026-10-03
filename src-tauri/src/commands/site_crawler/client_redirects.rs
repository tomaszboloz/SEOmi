use super::*;

pub(super) fn verify_amp_target(
    source_url: &str,
    source_final_url: &str,
    target_url: &str,
    crawled_statuses: &HashMap<String, u16>,
    canonical_targets: &HashMap<String, Option<String>>,
) -> (Option<u16>, Option<String>) {
    let Some(status) = crawled_statuses.get(target_url).copied() else {
        return (None, None);
    };
    let Some(canonical) = canonical_targets.get(target_url) else {
        return (Some(status), None);
    };
    let alignment = match canonical {
        Some(canonical)
            if same_hreflang_url(canonical, source_url)
                || same_hreflang_url(canonical, source_final_url) =>
        {
            "canonical-to-source"
        }
        Some(canonical) if same_hreflang_url(canonical, target_url) => "self-canonical",
        Some(_) => "canonical-points-elsewhere",
        None => "missing-canonical",
    };
    (Some(status), Some(alignment.into()))
}

pub(super) fn parse_client_redirect(
    source: &str,
    declaration: &str,
    base_url: &url::Url,
) -> CrawledClientRedirect {
    let (delay, destination) = declaration
        .split_once(';')
        .map(|(delay, destination)| (delay.trim(), Some(destination.trim())))
        .unwrap_or((declaration.trim(), None));
    let delay_seconds = delay
        .parse::<f64>()
        .ok()
        .filter(|seconds| seconds.is_finite() && *seconds >= 0.0);
    let target_url = destination
        .and_then(|value| value.split_once('='))
        .filter(|(key, _)| key.trim().eq_ignore_ascii_case("url"))
        .map(|(_, value)| value.trim().trim_matches(['\"', '\'']))
        .filter(|value| !value.is_empty())
        .and_then(|value| base_url.join(value).ok())
        .filter(|url| matches!(url.scheme(), "http" | "https"))
        .map(|url| url.to_string());
    CrawledClientRedirect {
        source: source.into(),
        declaration: declaration.into(),
        delay_seconds,
        target_url,
    }
}
