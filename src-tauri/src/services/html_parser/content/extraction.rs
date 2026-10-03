use super::*;

pub(in crate::services::html_parser) fn extract_content_stats(
    document: &Html,
    total_html_bytes: usize,
    language: Option<&str>,
) -> ContentStats {
    let Some(full_text) = visible_content_text(document) else {
        return ContentStats::default();
    };
    let effective_language = language.or_else(|| infer_content_language(&full_text));
    let words = content_words(&full_text);
    let mut stats = content_metrics(&words, &full_text, effective_language);
    stats.text_ratio_percent = if total_html_bytes > 0 {
        ((full_text.trim().len() as f32 / total_html_bytes as f32) * 100.0).min(100.0)
    } else {
        0.0
    };
    stats.top_keywords = content_keywords(&words);
    let mut chars = full_text.chars();
    stats.body_text = chars.by_ref().take(MAX_STORED_BODY_TEXT_CHARS).collect();
    stats.body_text_truncated = chars.next().is_some();
    stats
}
