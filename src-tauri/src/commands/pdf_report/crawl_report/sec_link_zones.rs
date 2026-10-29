//! Internal link placement by DOM zone (#70) with the SPRS reference weights (#71).
use super::data::{flag, list, Crawl};
use super::strings::{report as s, t};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::field;

/// Same reference profile as `SPRS_REFERENCE_WEIGHTS` in the app; `None` = neutral weight 1.
const ZONES: [(&str, Option<f64>, &str); 7] = [
    ("main", None, s::ZONE_MAIN),
    ("above_fold", Some(1.0), s::ZONE_ABOVE),
    ("below_fold", Some(0.75), s::ZONE_BELOW),
    ("widget", Some(0.35), s::ZONE_WIDGET),
    ("nav_breadcrumb", Some(0.25), s::ZONE_NAV),
    ("sidebar_footer", Some(0.05), s::ZONE_FOOTER),
    ("unknown", None, s::ZONE_UNKNOWN),
];

fn zone_index(link: &serde_json::Value) -> usize {
    let zone = field(link, "zone").unwrap_or_default();
    ZONES
        .iter()
        .position(|(id, _, _)| *id == zone)
        .unwrap_or(ZONES.len() - 1)
}

pub fn link_zones(c: &Crawl) -> Table {
    let mut counts = [(0usize, 0usize); ZONES.len()];
    let mut total = 0usize;
    for page in c.pages {
        let mut seen = [false; ZONES.len()];
        for link in list(page, "links")
            .iter()
            .filter(|l| flag(l, "is_internal"))
        {
            let index = zone_index(link);
            counts[index].0 += 1;
            seen[index] = true;
            total += 1;
        }
        seen.iter()
            .enumerate()
            .filter(|(_, hit)| **hit)
            .for_each(|(index, _)| counts[index].1 += 1);
    }
    let rows = ZONES
        .iter()
        .zip(counts)
        .filter(|(_, (links, _))| *links > 0)
        .map(|((_, weight, label), (links, pages))| {
            vec![
                t(label).to_owned(),
                links.to_string(),
                format!("{:.1}%", links as f64 * 100.0 / total.max(1) as f64),
                pages.to_string(),
                weight.map_or_else(|| t(s::ZONE_NEUTRAL).to_owned(), |w| format!("{w:.2}")),
            ]
        })
        .collect();
    let columns = [
        (t(s::COL_ZONE), 34.0),
        (t(s::COL_LINKS), 14.0),
        (t(s::COL_SHARE), 14.0),
        (t(s::COL_PAGES), 14.0),
        (t(s::COL_WEIGHT), 24.0),
    ];
    Table::text(
        t(s::T_LINK_ZONES),
        Some(t(s::LINK_ZONES_INTRO).into()),
        &columns,
        rows,
    )
}
