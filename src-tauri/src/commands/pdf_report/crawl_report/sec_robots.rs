use super::data::{f, joined, list, Crawl};
use super::strings::{report as s, t};
use super::tables::Table;
use serde_json::Value;

fn rules(items: &[Value]) -> String {
    items
        .iter()
        .map(|rule| format!("{}: {}", f(rule, "directive"), f(rule, "path")))
        .collect::<Vec<_>>()
        .join("   ")
}

pub fn robots_rules(c: &Crawl) -> Vec<Table> {
    let applicable = c
        .rlist("robots_applicable_rules")
        .iter()
        .map(|r| vec![f(r, "directive"), f(r, "path")])
        .collect();
    let matrix = c
        .rlist("robots_agent_matrix")
        .iter()
        .map(|agent| {
            let group = if agent.get("specific_group").and_then(Value::as_bool) == Some(true) {
                t(s::YES)
            } else {
                t(s::NO)
            };
            vec![
                f(agent, "user_agent"),
                group.into(),
                rules(list(agent, "applicable_rules")),
                f(agent, "crawl_delay_ms"),
            ]
        })
        .collect();
    let directives = c
        .rlist("robots_sitemap_directives")
        .iter()
        .filter_map(|d| d.as_str())
        .map(|d| vec![d.to_owned()])
        .collect();
    let chain = c
        .rlist("robots_txt_redirect_chain")
        .iter()
        .map(|hop| {
            vec![
                f(hop, "from_url"),
                f(hop, "http_status"),
                f(hop, "to_url"),
                f(hop, "response_time_ms"),
            ]
        })
        .collect();
    let rule_cols = [(t(s::COL_DIRECTIVE), 25.0), (t(s::COL_PATH), 75.0)];
    let matrix_cols = [
        (t(s::COL_AGENT), 38.0),
        (t(s::COL_GROUP), 12.0),
        (t(s::COL_RULES), 38.0),
        (t(s::COL_DELAY_MS), 12.0),
    ];
    let chain_cols = [
        (t(s::COL_FROM), 38.0),
        (t(s::COL_STATUS), 10.0),
        (t(s::COL_TO), 38.0),
        (t(s::COL_TIME), 14.0),
    ];
    vec![
        Table::text(t(s::T_RULES), None, &rule_cols, applicable),
        Table::text(t(s::T_AGENTS), None, &matrix_cols, matrix),
        Table::text(
            t(s::T_DIRECTIVES),
            None,
            &[(t(s::COL_URL), 100.0)],
            directives,
        ),
        Table::text(t(s::T_ROBOTS_CHAIN), None, &chain_cols, chain),
    ]
}

pub fn sitemap_and_rejected(c: &Crawl) -> Vec<Table> {
    let urls = c
        .rlist("sitemap_urls")
        .iter()
        .filter_map(|u| u.as_str())
        .map(|u| vec![u.to_owned()])
        .collect();
    let rejected = c
        .rlist("rejected_urls")
        .iter()
        .map(|r| vec![f(r, "url"), f(r, "reason")])
        .collect();
    vec![
        Table::text(t(s::T_SITEMAP_URLS), None, &[(t(s::COL_URL), 100.0)], urls),
        Table::text(
            t(s::T_REJECTED),
            None,
            &[(t(s::COL_URL), 55.0), (t(s::COL_REASON), 45.0)],
            rejected,
        ),
    ]
}

/// Pages whose indexability verdict carries reasons, such as robots blocks.
pub fn indexability_reasons(c: &Crawl) -> Table {
    let rows = c
        .pages
        .iter()
        .filter_map(|page| {
            let verdict = page.get("indexability_verdict")?;
            let reasons = joined(verdict, "reasons", "   ")?;
            Some(vec![f(page, "url"), f(verdict, "status"), reasons])
        })
        .collect();
    let columns = [
        (t(s::COL_URL), 34.0),
        (t(s::COL_VERDICT), 12.0),
        (t(s::COL_REASONS), 54.0),
    ];
    Table::text(
        t(s::T_REASONS),
        Some(t(s::REASONS_INTRO).into()),
        &columns,
        rows,
    )
}
