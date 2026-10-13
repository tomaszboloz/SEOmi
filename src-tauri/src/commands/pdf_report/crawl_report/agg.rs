use super::data::{list, page_url};
use super::evidence::page_evidence;
use super::recs::recommendation;
use crate::commands::pdf_report::audit_report::ctx::field;
use crate::commands::pdf_report::audit_report::model::Sev;
use serde_json::Value;

/// One kind of finding with every page it affects.
pub struct IssueType {
    pub sev: Sev,
    pub code: Option<String>,
    pub headline: String,
    pub advice: String,
    /// Page index, page URL and the page-specific evidence line.
    pub pages: Vec<(usize, String, String)>,
}

/// Groups messages that differ only by numbers, like the crawler's scoring.
pub fn finding_key(message: &str) -> String {
    let lower = message.trim().to_lowercase();
    let head = lower
        .split_once(':')
        .map_or(lower.as_str(), |(head, _)| head.trim());
    let mut key = String::new();
    let mut in_number = false;
    for character in head.chars() {
        if character.is_ascii_digit() {
            if !in_number {
                key.push('#');
            }
            in_number = true;
        } else {
            in_number = false;
            key.push(character);
        }
    }
    key.trim().to_owned()
}

fn runs(message: &str) -> Vec<(bool, String)> {
    let mut out: Vec<(bool, String)> = Vec::new();
    for character in message.chars() {
        let digit = character.is_ascii_digit();
        match out.last_mut() {
            Some((kind, text)) if *kind == digit => text.push(character),
            _ => out.push((digit, character.to_string())),
        }
    }
    out
}

/// Common wording of messages that differ in numbers or after a colon.
fn headline_of(messages: &[String]) -> String {
    let first = &messages[0];
    if messages.iter().all(|m| m == first) {
        return first.clone();
    }
    let head = first
        .split_once(':')
        .map_or(first.as_str(), |(head, _)| head);
    let others: Vec<Vec<(bool, String)>> = messages.iter().map(|m| runs(m)).collect();
    runs(head)
        .into_iter()
        .enumerate()
        .map(|(index, (digit, text))| {
            let varies = others
                .iter()
                .any(|r| r.get(index).map(|(_, t)| t) != Some(&text));
            if digit && varies {
                "N".into()
            } else {
                text
            }
        })
        .collect()
}

type Raw = (String, IssueType, Vec<(String, String)>);

/// Findings of all pages aggregated by type, Critical first.
pub fn aggregate(pages: &[Value]) -> Vec<IssueType> {
    let mut types: Vec<Raw> = Vec::new();
    for (index, page) in pages.iter().enumerate() {
        for issue in list(page, "issues") {
            let message = field(issue, "message").unwrap_or_default();
            let code = field(issue, "code");
            let sev = Sev::parse(&field(issue, "severity").unwrap_or_default());
            let id = code.clone().unwrap_or_else(|| finding_key(&message));
            let key = format!("{sev:?}|{id}");
            let slot = types.iter().position(|(k, _, _)| *k == key);
            let slot = slot.unwrap_or_else(|| {
                let advice = recommendation(code.as_deref(), &message, sev);
                let item = IssueType {
                    sev,
                    code,
                    headline: String::new(),
                    advice,
                    pages: Vec::new(),
                };
                types.push((key, item, Vec::new()));
                types.len() - 1
            });
            let fields = page_evidence(page, &message);
            types[slot]
                .1
                .pages
                .push((index, page_url(page), String::new()));
            types[slot].2.push((message, fields));
        }
    }
    let mut result: Vec<IssueType> = types.into_iter().map(finish).collect();
    result.sort_by_key(|item| (item.sev, std::cmp::Reverse(item.pages.len())));
    result
}

fn finish((_, mut item, found): Raw) -> IssueType {
    let messages: Vec<String> = found.iter().map(|(m, _)| m.clone()).collect();
    let same = messages.iter().all(|m| *m == messages[0]);
    item.headline = headline_of(&messages);
    for (page, (message, fields)) in item.pages.iter_mut().zip(found) {
        let parts = [fields, if same { String::new() } else { message }];
        page.2 = parts
            .iter()
            .filter(|p| !p.is_empty())
            .cloned()
            .collect::<Vec<_>>()
            .join(" \u{b7} ");
    }
    item
}
