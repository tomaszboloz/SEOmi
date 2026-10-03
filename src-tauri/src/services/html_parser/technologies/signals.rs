use super::*;

pub(in crate::services::html_parser) fn push_signal(
    name: &str,
    category: &str,
    evidence: String,
    confidence: &str,
    version: Option<String>,
    output: &mut Vec<TechnologySignal>,
) {
    if !output
        .iter()
        .any(|signal| signal.name == name && signal.category == category)
    {
        output.push(TechnologySignal {
            name: name.to_string(),
            category: category.to_string(),
            evidence,
            confidence: confidence.to_string(),
            version,
        });
    }
}
