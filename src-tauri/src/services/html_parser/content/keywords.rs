use super::*;

pub(in crate::services::html_parser) fn content_keywords(words: &[String]) -> Vec<KeywordStat> {
    let word_count = words.len();
    let mut freq_map: HashMap<String, usize> = HashMap::new();
    for w in words {
        if !is_stop_word(w) {
            *freq_map.entry(w.clone()).or_insert(0) += 1;
        }
    }

    let mut freq_vec: Vec<(String, usize)> = freq_map.into_iter().collect();
    freq_vec.sort_by_key(|a| std::cmp::Reverse(a.1));

    freq_vec
        .into_iter()
        .take(10)
        .map(|(k, v)| KeywordStat {
            keyword: k,
            count: v,
            density_percent: ((v as f32 / word_count as f32) * 10000.0).round() / 100.0,
        })
        .collect()
}
