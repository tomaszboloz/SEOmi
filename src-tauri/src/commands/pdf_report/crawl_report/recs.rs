use super::strings::recs::{GENERIC_CRITICAL, GENERIC_NOTICE, GENERIC_WARNING, RECOMMENDATIONS};
use crate::commands::pdf_report::audit_report::model::Sev;

/// Actionable advice for an issue, found by code first and message second.
pub fn recommendation(code: Option<&str>, message: &str, sev: Sev) -> String {
    let code = code.unwrap_or_default().to_lowercase();
    let message = message.to_lowercase();
    let by_code = RECOMMENDATIONS
        .iter()
        .find(|(fragment, _)| !code.is_empty() && code.contains(fragment));
    let found = by_code.or_else(|| {
        RECOMMENDATIONS
            .iter()
            .find(|(fragment, _)| message.contains(fragment))
    });
    match found {
        Some((_, advice)) => (*advice).to_owned(),
        None => match sev {
            Sev::Critical => GENERIC_CRITICAL,
            Sev::Warning => GENERIC_WARNING,
            Sev::Info => GENERIC_NOTICE,
        }
        .to_owned(),
    }
}
