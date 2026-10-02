use super::*;

pub(in crate::commands::site_crawler) fn parse_sitemap_directives(content: &str) -> Vec<String> {
    content
        .lines()
        .filter_map(|raw_line| {
            let line = raw_line.split('#').next().unwrap_or("").trim();
            let (key, value) = line.split_once(':')?;
            (key.trim().eq_ignore_ascii_case("sitemap") && !value.trim().is_empty())
                .then(|| value.trim().to_string())
        })
        .collect()
}

pub(in crate::commands::site_crawler) fn parse_sitemap_locations(content: &str) -> Vec<String> {
    static LOC: OnceLock<Option<Regex>> = OnceLock::new();
    LOC.get_or_init(|| Regex::new(r"(?is)<loc\s*>\s*(.*?)\s*</loc>").ok())
        .as_ref()
        .map(|pattern| {
            pattern
                .captures_iter(content)
                .filter_map(|captures| captures.get(1))
                .map(|capture| capture.as_str().trim().to_string())
                .filter(|url| !url.is_empty())
                .collect()
        })
        .unwrap_or_default()
}
