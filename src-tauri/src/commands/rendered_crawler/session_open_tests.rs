#[cfg(test)]
mod tests {
    use crate::commands::rendered_crawler::models::RenderOptions;
    use crate::commands::rendered_crawler::preview::build_preview_script;
    use crate::commands::rendered_crawler::preview::normalize_preview_value;

    #[test]
    fn test_normalize_preview_value_valid() {
        let val = normalize_preview_value("  hello  ", "Field", 10).unwrap();
        assert_eq!(val, "hello");
    }

    #[test]
    fn test_normalize_preview_value_empty() {
        assert!(normalize_preview_value("   ", "Field", 10).is_err());
    }

    #[test]
    fn test_normalize_preview_value_too_long() {
        assert!(normalize_preview_value("toolongstring", "Field", 5).is_err());
    }

    #[test]
    fn test_normalize_preview_value_null() {
        assert!(normalize_preview_value("abc\0", "Field", 10).is_err());
    }

    #[test]
    fn test_build_preview_script() {
        let script = build_preview_script("div.content", Some("match"), Some(0), "Not found");
        assert!(script.contains("div.content"));
        assert!(script.contains("match"));
        assert!(script.contains("Not found"));
    }

    #[test]
    fn test_render_options_default() {
        let opts = RenderOptions::default();
        assert!(opts.allowed_hosts.is_empty());
    }
}
