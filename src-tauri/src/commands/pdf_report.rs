pub mod audit_report;
pub mod crawl_report;
pub mod font;
pub mod font_pdf;
pub mod layout;
pub mod renderer;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod tests_generator;

#[cfg(test)]
mod tests_unicode;

use base64::Engine;
use serde_json::Value;

#[tauri::command]
pub fn generate_audit_pdf(audit: Value) -> Result<String, String> {
    let final_url = audit
        .get("final_url")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if final_url.is_empty() {
        return Err("The audit has no final URL to report.".into());
    }
    Ok(base64::engine::general_purpose::STANDARD.encode(audit_report::audit_pdf(&audit)))
}

#[tauri::command]
pub fn generate_crawl_pdf(run: Value) -> Result<String, String> {
    let start_url = run
        .pointer("/scope_start_url")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if start_url.is_empty() {
        return Err("The crawl run has no scope URL to report.".into());
    }
    Ok(base64::engine::general_purpose::STANDARD.encode(crawl_report::crawl_pdf(&run)))
}

#[cfg(test)]
mod tests_gaps;
