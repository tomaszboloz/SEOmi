use super::ctx::Ctx;
use super::strings::report as s;
use crate::commands::pdf_report::layout::color::{Rgb, MUTED, OK, WARNING};
use crate::commands::pdf_report::layout::text::EMPTY;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Ok,
    Attention,
    Info,
}

impl Status {
    pub fn label(self) -> &'static str {
        match self {
            Status::Ok => s::STATUS_OK,
            Status::Attention => s::STATUS_ATTENTION,
            Status::Info => s::STATUS_INFO,
        }
    }

    pub fn color(self) -> Rgb {
        match self {
            Status::Ok => OK,
            Status::Attention => WARNING,
            Status::Info => MUTED,
        }
    }
}

#[derive(Clone, Debug)]
pub struct Check {
    pub name: String,
    pub value: String,
    pub status: Status,
    pub advice: String,
}

pub struct Section {
    pub title: String,
    pub checks: Vec<Check>,
}

impl Check {
    pub fn new(name: &str, value: Option<String>, status: Status, advice: &str) -> Check {
        Check {
            name: name.to_owned(),
            value: value.unwrap_or_else(|| EMPTY.to_owned()),
            status,
            advice: advice.to_owned(),
        }
    }

    pub fn info(name: &str, value: Option<String>) -> Check {
        Check::new(name, value, Status::Info, EMPTY)
    }

    /// Passes unless the value is missing, which needs the given advice.
    pub fn required(name: &str, value: Option<String>, advice: &str) -> Check {
        match value {
            Some(_) => Check::new(name, value, Status::Ok, s::NO_ACTION),
            None => Check::new(name, None, Status::Attention, advice),
        }
    }
}

impl Ctx<'_> {
    /// Needs attention when a finding with one of the code prefixes exists.
    pub fn judged(&self, name: &str, value: Option<String>, prefixes: &[&str]) -> Check {
        match self.issue(prefixes) {
            Some(found) => Check::new(name, value, Status::Attention, &found.recommendation),
            None if value.is_some() => Check::new(name, value, Status::Ok, s::NO_ACTION),
            None => Check::info(name, None),
        }
    }
}

impl Ctx<'_> {
    /// Like `judged`, but a non-zero count needs attention even without a finding.
    pub fn counted(
        &self,
        name: &str,
        value: String,
        count: usize,
        prefixes: &[&str],
        fallback: &str,
    ) -> Check {
        let value = Some(value);
        match self.issue(prefixes) {
            Some(found) => Check::new(name, value, Status::Attention, &found.recommendation),
            None if count > 0 => Check::new(name, value, Status::Attention, fallback),
            None => Check::new(name, value, Status::Ok, s::NO_ACTION),
        }
    }
}

pub fn yes_no(flag: Option<bool>) -> Option<String> {
    flag.map(|value| if value { s::YES } else { s::NO }.to_owned())
}
