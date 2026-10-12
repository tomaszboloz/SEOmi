use super::metadata::audit_meta_tags;
use crate::models::audit_data::MetaTags;
use url::Url;

fn robots_codes(robots: &str) -> Vec<String> {
    let meta = MetaTags {
        robots: Some(robots.into()),
        ..Default::default()
    };
    audit_meta_tags(&meta, &Url::parse("https://example.com/").unwrap())
        .into_iter()
        .filter_map(|issue| issue.code)
        .filter(|code| code.starts_with("meta_robots"))
        .collect()
}

#[test]
fn only_noindex_directives_raise_the_robots_issue() {
    assert!(robots_codes("index, follow").is_empty());
    assert_eq!(robots_codes("NoIndex, nofollow"), ["meta_robots_noindex"]);
}
