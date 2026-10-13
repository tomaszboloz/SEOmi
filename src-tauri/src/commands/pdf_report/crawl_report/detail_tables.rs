use super::data::Crawl;
use super::tables::Table;
use super::{
    sec_dupes, sec_extra, sec_http, sec_links, sec_media, sec_meta, sec_nav, sec_redirects,
    sec_robots, sec_schema,
};
use serde_json::Value;

/// Whether the report template (if any) includes a section; no template means all.
pub fn allows(run: &Value, section: &str) -> bool {
    run.get("report_template_sections")
        .and_then(Value::as_array)
        .map_or(true, |sections| {
            sections.iter().any(|item| item.as_str() == Some(section))
        })
}

/// Dedicated section tables allowed by the template, in report order.
pub fn detail_tables(c: &Crawl) -> Vec<Table> {
    let on = |section: &str| allows(c.run, section);
    let mut all = Vec::new();
    if on("issues") {
        all.extend(sec_dupes::duplicates(c));
    }
    if on("pages") {
        all.push(sec_redirects::redirects(c));
        all.push(sec_redirects::client_redirects(c));
    }
    if on("links") {
        all.push(sec_links::broken_links(c));
        all.push(sec_links::external_links(c));
    }
    if on("pages") {
        all.push(sec_meta::canonicals(c));
        all.push(sec_meta::hreflang(c));
        all.push(sec_nav::pagination(c));
        all.push(sec_nav::amp(c));
        all.push(sec_schema::structured_data(c));
        all.push(sec_schema::html_validation(c));
    }
    if on("images") {
        all.push(sec_media::images(c));
    }
    if on("resources") {
        all.push(sec_media::resources(c));
    }
    let extra = sec_extra::frames_and_searches(c);
    all.extend(
        extra
            .into_iter()
            .zip(["frames", "custom-search"])
            .filter(|(_, key)| on(key))
            .map(|(table, _)| table),
    );
    all.extend(sec_robots::robots_rules(c));
    all.extend(sec_robots::sitemap_and_rejected(c));
    all.push(sec_robots::indexability_reasons(c));
    if on("pages") {
        all.push(sec_http::http_details(c));
    }
    all
}
