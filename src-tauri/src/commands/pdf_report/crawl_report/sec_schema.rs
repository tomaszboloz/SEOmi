use super::data::{f, joined, list, num, Crawl};
use super::strings::{report as s, t, tf};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::{field, format_number};

pub fn structured_data(c: &Crawl) -> Table {
    let mut rows = Vec::new();
    for page in c.pages {
        let types = joined(page, "schema_types", ", ").unwrap_or_default();
        let errors = num(page, "schema_syntax_errors").unwrap_or(0.0);
        let findings: Vec<String> = list(page, "schema_validation_findings")
            .iter()
            .map(|item| {
                let finding = item.get("finding").unwrap_or(item);
                let place = format!("{} #{}", f(item, "format"), f(item, "declaration_index"));
                tf(
                    t(s::SCHEMA_FINDING),
                    &[&place, &f(finding, "path"), &f(finding, "message")],
                )
            })
            .collect();
        if types.is_empty() && errors == 0.0 && findings.is_empty() {
            continue;
        }
        rows.push(vec![
            f(page, "url"),
            types,
            format_number(errors),
            findings.join("   "),
        ]);
    }
    let columns = [
        (t(s::COL_URL), 26.0),
        (t(s::COL_TYPES), 20.0),
        (t(s::COL_SYNTAX), 9.0),
        (t(s::COL_FINDINGS), 45.0),
    ];
    Table::text(t(s::T_SCHEMA), None, &columns, rows)
}

pub fn html_validation(c: &Crawl) -> Table {
    let mut rows = Vec::new();
    for page in c.pages {
        for item in list(page, "html_validation_findings") {
            let place = match (field(item, "line"), field(item, "column")) {
                (Some(line), Some(column)) => tf(t(s::LINE_COLUMN), &[&line, &column]),
                _ => String::new(),
            };
            let element = format!("{} {place}", f(item, "element"));
            rows.push(vec![
                f(page, "url"),
                f(item, "severity"),
                f(item, "code"),
                f(item, "message"),
                element,
            ]);
        }
    }
    let columns = [
        (t(s::COL_URL), 24.0),
        (t(s::COL_SEVERITY), 9.0),
        (t(s::COL_CODE), 17.0),
        (t(s::COL_FINDING), 32.0),
        (t(s::COL_ELEMENT), 18.0),
    ];
    Table::text(t(s::T_HTML), None, &columns, rows)
}
