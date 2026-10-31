//! Localized provenance and evidence coverage of the Trust calculation.
use super::focus_text::arg;
use super::strings::trust as k;
use super::strings::{t, tf};
use serde_json::Value;

pub fn notes(trust: &Value) -> Vec<String> {
    let mut notes = Vec::new();
    if let (Some(version), Some(profile)) = (trust.get("profile_version"), trust.get("profile_id"))
    {
        notes.push(tf(
            t(k::PROFILE),
            &[&arg(Some(profile)), &arg(Some(version))],
        ));
    }
    if let Some(scoring) = trust
        .get("scoring_profile")
        .filter(|value| value.as_str().is_some_and(|name| name != "legacy"))
    {
        notes.push(tf(t(k::SCORING), &[&arg(Some(scoring))]));
    }
    if let Some(coverage) = trust.get("coverage").and_then(Value::as_object) {
        let detail = coverage
            .iter()
            .filter_map(|(layer, value)| {
                let item = value.as_object()?;
                let label = match layer.as_str() {
                    "schemaGraph" => t(k::K_SCHEMA),
                    "sameAs" => t(k::K_SAME_AS),
                    "authorAlignment" => t(k::K_AUTHOR),
                    "citationQuality" => t(k::K_CITATION),
                    "transparency" => t(k::K_TRANSPARENCY),
                    _ => layer.as_str(),
                };
                Some(format!(
                    "{label} {}/{}/{}/{}",
                    arg(item.get("observed")),
                    arg(item.get("declared")),
                    arg(item.get("verified")),
                    arg(item.get("unknown"))
                ))
            })
            .collect::<Vec<_>>()
            .join("; ");
        if !detail.is_empty() {
            notes.push(format!("{}: {detail}", t(k::COVERAGE)));
        }
    }
    notes
}
