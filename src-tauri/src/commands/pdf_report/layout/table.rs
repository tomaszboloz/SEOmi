use super::color::{Rgb, BRAND, PANEL, RULE, ZEBRA};
use super::doc::{Doc, CONTENT_W, MARGIN, TOP};
use super::text::Style;

pub(super) const PAD_X: f32 = 5.0;
const PAD_Y: f32 = 3.5;
const HEAD_H: f32 = 17.0;
const HEAD: Style = Style::new(8.0, super::color::TEXT, true);

pub struct Column {
    pub title: String,
    pub weight: f32,
}

impl Column {
    pub fn new(title: &str, weight: f32) -> Self {
        Self {
            title: title.to_owned(),
            weight,
        }
    }
}

#[derive(Clone)]
pub struct Cell {
    pub text: String,
    pub style: Style,
    pub fill: Option<Rgb>,
}

impl Cell {
    pub fn new(text: impl Into<String>) -> Self {
        Self::styled(text, Style::BODY, None)
    }

    pub fn styled(text: impl Into<String>, style: Style, fill: Option<Rgb>) -> Self {
        Self {
            text: text.into(),
            style,
            fill,
        }
    }
}

pub(super) fn widths(columns: &[Column]) -> Vec<f32> {
    let total: f32 = columns.iter().map(|column| column.weight).sum();
    columns
        .iter()
        .map(|column| CONTENT_W * column.weight / total)
        .collect()
}

impl Doc {
    /// Height the table needs before it may start on the current page.
    pub fn table_need(&self, columns: &[Column], rows: &[Vec<Cell>]) -> f32 {
        let widths = widths(columns);
        let lead = Style::BODY.leading();
        let first = rows.first().map_or(1, |row| self.row_lines(row, &widths).0);
        let capacity = self.limit() - TOP - HEAD_H;
        let whole = first as f32 * lead + 2.0 * PAD_Y;
        HEAD_H + if whole <= capacity { whole } else { 3.0 * lead }
    }

    /// Draws a table that repeats its header on every page and never cuts a
    /// row in the middle unless the row is taller than a whole page.
    pub fn table(&mut self, columns: &[Column], rows: &[Vec<Cell>]) {
        let widths = widths(columns);
        self.ensure(self.table_need(columns, rows));
        self.table_header(columns, &widths);
        for (index, row) in rows.iter().enumerate() {
            self.table_row(columns, &widths, index, row);
        }
        self.skip(10.0);
    }

    /// Wrapped lines of every cell and the number of lines the row needs.
    fn row_lines(&self, row: &[Cell], widths: &[f32]) -> (usize, Vec<Vec<String>>) {
        let lines: Vec<Vec<String>> = row
            .iter()
            .zip(widths)
            .map(|(cell, width)| self.wrap(&cell.text, width - 2.0 * PAD_X, cell.style))
            .collect();
        (lines.iter().map(Vec::len).max().unwrap_or(1), lines)
    }

    fn table_header(&mut self, columns: &[Column], widths: &[f32]) {
        self.rect(MARGIN, self.y, CONTENT_W, HEAD_H, PANEL);
        let mut offset = 0.0;
        for (column, width) in columns.iter().zip(widths) {
            let left = self.column_left(offset, *width);
            self.cell_text(left, *width, self.y + 11.5, HEAD, &column.title);
            offset += width;
        }
        self.hline(MARGIN, MARGIN + CONTENT_W, self.y + HEAD_H, BRAND, 1.0);
        self.y += HEAD_H + 0.8;
    }

    fn table_row(&mut self, columns: &[Column], widths: &[f32], index: usize, row: &[Cell]) {
        let (total, lines) = self.row_lines(row, widths);
        let lead = Style::BODY.leading();
        let page_lines = ((self.limit() - TOP - HEAD_H - 2.0 * PAD_Y) / lead) as usize;
        let mut start = 0;
        while start < total {
            let room = ((self.remaining() - 2.0 * PAD_Y) / lead).max(0.0) as usize;
            let need = total - start;
            if room == 0 || (room < need && need <= page_lines) {
                self.new_page();
                self.table_header(columns, widths);
                continue;
            }
            let take = need.min(room);
            self.row_chunk(widths, index, row, &lines, start..start + take);
            start += take;
        }
    }

    fn row_chunk(
        &mut self,
        widths: &[f32],
        index: usize,
        row: &[Cell],
        lines: &[Vec<String>],
        span: std::ops::Range<usize>,
    ) {
        let lead = Style::BODY.leading();
        let height = span.len() as f32 * lead + 2.0 * PAD_Y;
        if index % 2 == 1 {
            self.rect(MARGIN, self.y, CONTENT_W, height, ZEBRA);
        }
        let mut offset = 0.0;
        for ((cell, cell_lines), width) in row.iter().zip(lines).zip(widths) {
            let x = self.column_left(offset, *width);
            if let Some(fill) = cell.fill {
                self.rect(x, self.y, *width, height, fill);
            }
            for (offset, line) in cell_lines
                .iter()
                .skip(span.start)
                .take(span.len())
                .enumerate()
            {
                let baseline = self.y + PAD_Y + offset as f32 * lead + cell.style.size + 1.0;
                self.cell_text(x, *width, baseline, cell.style, line);
            }
            offset += width;
        }
        self.hline(MARGIN, MARGIN + CONTENT_W, self.y + height, RULE, 0.4);
        self.y += height;
    }
}
