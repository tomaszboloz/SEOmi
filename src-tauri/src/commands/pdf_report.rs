pub mod audit_text;
pub mod charts;
pub mod crawl_page_summary;
pub mod crawl_resources_table;
pub mod crawl_tables;
pub mod crawl_text;
pub mod renderer;
pub mod text_utils;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod tests_edges;

#[cfg(test)]
mod tests_tables;

#[cfg(test)]
mod tests_generator;

#[cfg(test)]
mod tests_text_and_charts;

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
    Ok(
        base64::engine::general_purpose::STANDARD.encode(renderer::pdf_bytes(
            audit_text::audit_text_lines(&audit),
            charts::audit_chart(&audit),
        )),
    )
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
    Ok(
        base64::engine::general_purpose::STANDARD.encode(renderer::pdf_bytes(
            crawl_text::crawl_text_lines(&run),
            charts::crawl_chart(&run),
        )),
    )
}
