use crate::models::audit_data::{IndexabilityAssessment, MetaTags};
use crate::utils::url_validator::validate_and_normalize_url;
use url::Url;

pub(super) fn contains_noindex(value: &str) -> bool {
    value
        .split(|c: char| c == ',' || c.is_whitespace())
        .any(|directive| {
            matches!(
                directive.trim().to_ascii_lowercase().as_str(),
                "noindex" | "none"
            )
        })
}

pub(super) fn urls_match(left: &str, right: &str) -> bool {
    let normalize = |value: &str| {
        let mut parsed = match Url::parse(value) {
            Ok(value) => value,
            Err(_) => return value.trim_end_matches('/').to_string(),
        };
        parsed.set_fragment(None);
        let normalized = parsed.to_string();
        normalized.trim_end_matches('/').to_string()
    };
    normalize(left) == normalize(right)
}

pub(super) fn assess_indexability(
    http_status: u16,
    meta_tags: &MetaTags,
    x_robots_tag: Option<String>,
    final_url: &str,
) -> IndexabilityAssessment {
    let meta_robots = meta_tags.robots.clone();
    let canonical = meta_tags.canonical.clone();
    let canonical_matches_final_url = canonical
        .as_deref()
        .map(|value| urls_match(value, final_url));
    let mut reasons = Vec::new();

    if !(200..300).contains(&http_status) {
        reasons.push(format!(
            "Końcowa odpowiedź HTTP ma status {http_status}, a nie 2xx."
        ));
    }
    if meta_robots.as_deref().is_some_and(contains_noindex) {
        reasons.push("Meta robots zawiera dyrektywę noindex lub none.".to_string());
    }
    if x_robots_tag.as_deref().is_some_and(contains_noindex) {
        reasons.push("Nagłówek X-Robots-Tag zawiera dyrektywę noindex lub none.".to_string());
    }

    let blocked = !reasons.is_empty();
    if canonical.is_none() {
        reasons.push("Brak canonical; lokalny audyt nie potwierdza preferowanego URL.".to_string());
    } else if canonical_matches_final_url == Some(false) {
        reasons.push("Canonical wskazuje inny URL; wymaga weryfikacji celu canonical.".to_string());
    }

    IndexabilityAssessment {
        status: if blocked {
            "blocked".to_string()
        } else if reasons.is_empty() {
            "indexable".to_string()
        } else {
            "uncertain".to_string()
        },
        reasons,
        meta_robots,
        x_robots_tag,
        canonical,
        canonical_matches_final_url,
        canonical_target_checked: false,
        canonical_target_status: None,
        canonical_target_check_error: None,
    }
}

async fn production_check(url: String) -> anyhow::Result<(u16, u64)> {
    crate::services::http_client::check_url_status(&url, 5).await
}

pub(super) async fn verify_canonical_target(
    assessment: &mut IndexabilityAssessment,
    current_status: u16,
) {
    verify_canonical_target_with(assessment, current_status, production_check).await
}

pub(super) async fn verify_canonical_target_with<F, Fut>(
    assessment: &mut IndexabilityAssessment,
    current_status: u16,
    check: F,
) where
    F: FnOnce(String) -> Fut,
    Fut: std::future::Future<Output = anyhow::Result<(u16, u64)>>,
{
    let Some(canonical) = assessment.canonical.as_deref() else {
        return;
    };
    if assessment.canonical_matches_final_url == Some(true) {
        assessment.canonical_target_checked = true;
        assessment.canonical_target_status = Some(current_status);
        return;
    }
    let target = match validate_and_normalize_url(canonical) {
        Ok(target) => target,
        Err(error) => {
            assessment.canonical_target_check_error =
                Some(format!("Canonical target was not requested: {error}"));
            assessment
                .reasons
                .push("Canonical target could not pass the local URL safety policy.".to_string());
            return;
        }
    };
    match check(target.to_string()).await {
        Ok((status, _)) => {
            assessment.canonical_target_checked = true;
            assessment.canonical_target_status = Some(status);
        }
        Err(error) => {
            assessment.canonical_target_check_error =
                Some(format!("Canonical target check failed: {error}"))
        }
    }
}

#[cfg(test)]
#[path = "indexability_target_tests.rs"]
mod target_tests;
