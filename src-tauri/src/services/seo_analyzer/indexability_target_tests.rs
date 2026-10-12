use super::{assess_indexability, verify_canonical_target};
use crate::models::audit_data::MetaTags;

fn assessment_with_canonical(
    canonical: Option<&str>,
    final_url: &str,
) -> crate::models::audit_data::IndexabilityAssessment {
    let meta = MetaTags {
        canonical: canonical.map(str::to_string),
        ..MetaTags::default()
    };
    assess_indexability(200, &meta, None, final_url)
}

#[tokio::test]
async fn no_canonical_leaves_the_assessment_untouched() {
    let mut assessment = assessment_with_canonical(None, "https://audit.example/");
    verify_canonical_target(&mut assessment, 200).await;
    assert!(!assessment.canonical_target_checked);
    assert!(assessment.canonical_target_status.is_none());
}

#[tokio::test]
async fn matching_canonical_reuses_the_current_status() {
    let mut assessment = assessment_with_canonical(
        Some("https://audit.example/page#top"),
        "https://audit.example/page/",
    );
    verify_canonical_target(&mut assessment, 203).await;
    assert!(assessment.canonical_target_checked);
    assert_eq!(assessment.canonical_target_status, Some(203));
}

#[tokio::test]
async fn unsafe_canonical_target_is_never_requested() {
    let mut assessment =
        assessment_with_canonical(Some("http://127.0.0.1/other"), "https://audit.example/");
    verify_canonical_target(&mut assessment, 200).await;
    assert!(!assessment.canonical_target_checked);
    assert!(assessment
        .canonical_target_check_error
        .as_deref()
        .unwrap()
        .contains("was not requested"));
    assert!(assessment
        .reasons
        .iter()
        .any(|reason| reason.contains("local URL safety policy")));
}

#[tokio::test]
async fn unresolvable_canonical_target_records_the_check_outcome() {
    let mut assessment = assessment_with_canonical(
        Some("https://canonical-target.invalid/other"),
        "https://audit.example/",
    );
    verify_canonical_target(&mut assessment, 200).await;
    let failed = assessment.canonical_target_check_error.is_some();
    assert_eq!(failed, !assessment.canonical_target_checked);
    assert_eq!(failed, assessment.canonical_target_status.is_none());
}

#[tokio::test]
async fn reachable_canonical_target_records_its_status() {
    use super::verify_canonical_target_with;
    let mut assessment =
        assessment_with_canonical(Some("https://other.example/page"), "https://audit.example/");
    verify_canonical_target_with(&mut assessment, 200, |url| async move {
        assert_eq!(url, "https://other.example/page");
        Ok((404, 0))
    })
    .await;
    assert!(assessment.canonical_target_checked);
    assert_eq!(assessment.canonical_target_status, Some(404));
}
