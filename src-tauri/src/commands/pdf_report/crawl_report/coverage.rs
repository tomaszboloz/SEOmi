use super::strings::{report as s, t, tf};
use super::tables::Table;

pub(super) fn coverage(tables: &[Table], sections: &[Table]) -> Table {
    let mut rows: Vec<Vec<String>> = sections
        .iter()
        .chain(tables)
        .map(|table| {
            let count = table.rows.len() + table.omitted;
            let result = match count {
                0 => t(s::NONE_FOUND).to_owned(),
                1 => t(s::ROW_ONE).to_owned(),
                _ => tf(t(s::ROWS), &[&count.to_string()]),
            };
            vec![table.title.clone(), result]
        })
        .collect();
    rows.push(vec![t(s::T_COMPARISON).into(), t(s::NO_COMPARISON).into()]);
    let columns = [(t(s::COL_AREA), 45.0), (t(s::COL_RESULT), 55.0)];
    Table::text(
        t(s::T_COVERAGE),
        Some(t(s::COVERAGE_INTRO).into()),
        &columns,
        rows,
    )
}
