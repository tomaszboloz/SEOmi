use super::check::{Check, Section, Status};
use super::strings::{report as s, t};
use crate::commands::pdf_report::layout::color::{MUTED, OK};
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::table::{Cell, Column};
use crate::commands::pdf_report::layout::text::Style;

fn status_cell(status: Status) -> Cell {
    let color = status.color();
    let fill = (status != Status::Info).then(|| color.tint(0.88));
    Cell::styled(status.label(), Style::BODY.colored(color).bold(), fill)
}

fn rows(checks: &[Check]) -> Vec<Vec<Cell>> {
    checks
        .iter()
        .map(|check| {
            vec![
                Cell::styled(check.name.clone(), Style::BODY.bold(), None),
                Cell::new(check.value.clone()),
                status_cell(check.status),
                Cell::styled(check.advice.clone(), Style::BODY.colored(MUTED), None),
            ]
        })
        .collect()
}

impl Doc {
    pub fn details(&mut self, sections: &[Section]) {
        self.heading(s::DETAILS);
        let columns = [
            Column::new(s::COL_CHECK, 22.0),
            Column::new(s::COL_VALUE, 29.0),
            Column::new(s::COL_STATUS, 15.0),
            Column::new(s::COL_ADVICE, 34.0),
        ];
        for section in sections {
            self.ensure(70.0);
            self.text(MARGIN, self.y + 10.0, Style::HEADING, &section.title);
            self.skip(16.0);
            self.table(&columns, &rows(&section.checks));
        }
    }

    /// Short summary of what passed, so a clean audit is never an empty report.
    pub fn passed_checks(&mut self, sections: &[Section]) {
        let total: usize = sections.iter().map(|section| section.checks.len()).sum();
        let passed: Vec<(&str, Vec<&str>)> = sections
            .iter()
            .map(|section| {
                let names = section.checks.iter().filter(|c| c.status == Status::Ok);
                (
                    section.title.as_str(),
                    names.map(|c| c.name.as_str()).collect(),
                )
            })
            .filter(|(_, names): &(&str, Vec<&str>)| !names.is_empty())
            .collect();
        let count: usize = passed.iter().map(|(_, names)| names.len()).sum();
        self.heading(s::PASSED);
        if count == 0 {
            return self.paragraph(MARGIN, CONTENT_W, Style::BODY, s::NOTHING_PASSED);
        }
        let summary = t(s::PASSED_SUMMARY, &[&count.to_string(), &total.to_string()]);
        self.paragraph(MARGIN, CONTENT_W, Style::BODY.colored(OK).bold(), &summary);
        self.skip(6.0);
        let table = [Column::new(s::COL_AREA, 26.0), Column::new(s::PASSED, 74.0)];
        let body = passed
            .iter()
            .map(|(title, names)| {
                vec![
                    Cell::styled(*title, Style::BODY.bold(), None),
                    Cell::new(names.join(", ")),
                ]
            })
            .collect::<Vec<_>>();
        self.table(&table, &body);
    }
}
