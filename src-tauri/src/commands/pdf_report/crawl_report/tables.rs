use super::strings::{report as s, t, tf};
use crate::commands::pdf_report::layout::color::{CRITICAL, MUTED, OK, WARNING};
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::table::{Cell, Column};
use crate::commands::pdf_report::layout::text::{dash, Style};

/// Longest list printed in full; the omitted rest is stated explicitly.
pub const MAX_ROWS: usize = 400;

pub struct Table {
    pub title: String,
    pub intro: Option<String>,
    pub columns: Vec<Column>,
    pub rows: Vec<Vec<Cell>>,
    pub omitted: usize,
}

impl Table {
    pub fn new(
        title: &str,
        intro: Option<String>,
        columns: &[(&str, f32)],
        rows: Vec<Vec<Cell>>,
    ) -> Self {
        let omitted = rows.len().saturating_sub(MAX_ROWS);
        let mut rows = rows;
        rows.truncate(MAX_ROWS);
        let columns = columns
            .iter()
            .map(|(title, weight)| Column::new(title, *weight))
            .collect();
        Self {
            title: title.into(),
            intro,
            columns,
            rows,
            omitted,
        }
    }

    /// Plain text rows; blank values become the missing-value dash.
    pub fn text(
        title: &str,
        intro: Option<String>,
        columns: &[(&str, f32)],
        rows: Vec<Vec<String>>,
    ) -> Self {
        let rows = rows
            .into_iter()
            .map(|row| row.iter().map(|v| Cell::new(dash(v))).collect())
            .collect();
        Self::new(title, intro, columns, rows)
    }
}

/// HTTP status cell coloured by class.
pub fn status_cell(status: Option<String>) -> Cell {
    let code = status.as_deref().and_then(|v| v.parse::<u32>().ok());
    let color = match code {
        Some(200..=299) => OK,
        Some(300..=399) => WARNING,
        Some(_) => CRITICAL,
        None => MUTED,
    };
    Cell::styled(
        dash(status.as_deref().unwrap_or("")),
        Style::BODY.colored(color).bold(),
        None,
    )
}

impl Doc {
    /// Sub-heading, optional intro and the table, or a "none found" line.
    pub fn data_table(&mut self, table: &Table) {
        let need = if table.rows.is_empty() {
            40.0
        } else {
            50.0 + self.table_need(&table.columns, &table.rows)
        };
        self.ensure(need);
        self.text(
            MARGIN,
            self.y + 11.0,
            Style::new(12.0, crate::commands::pdf_report::layout::color::TEXT, true),
            &table.title,
        );
        self.skip(18.0);
        if let Some(intro) = &table.intro {
            self.paragraph(MARGIN, CONTENT_W, Style::CAPTION, intro);
            self.skip(4.0);
        }
        if table.rows.is_empty() {
            self.paragraph(MARGIN, CONTENT_W, Style::BODY.colored(OK), t(s::NONE_FOUND));
            return self.skip(10.0);
        }
        let mut rows = table.rows.clone();
        if table.omitted > 0 {
            let note = tf(t(s::MORE_ROWS), &[&table.omitted.to_string()]);
            let mut row = vec![Cell::styled(note, Style::BODY.colored(MUTED), None)];
            row.extend((1..table.columns.len()).map(|_| Cell::new(dash(""))));
            rows.push(row);
        }
        self.table(&table.columns, &rows);
    }
}
