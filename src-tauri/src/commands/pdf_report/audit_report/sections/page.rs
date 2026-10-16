use super::super::check::{yes_no, Check, Section, Status};
use super::super::ctx::{field, Ctx};
use super::super::strings::{checks as c, t, tf};
use crate::commands::pdf_report::layout::text::EMPTY;

fn with_length(value: Option<String>, length: Option<String>) -> Option<String> {
    let value = value?;
    Some(match length {
        Some(length) => tf(t(c::CHARS), &[&value, &length]),
        None => value,
    })
}

pub fn meta_tags(ctx: &Ctx) -> Section {
    let meta = |key: &str| ctx.text(&format!("/meta_tags/{key}"));
    let length = |key: &str| ctx.count(&format!("/meta_tags/{key}"));
    Section {
        title: t(c::META_TITLE).into(),
        checks: vec![
            ctx.judged(
                t(c::TITLE),
                with_length(meta("title"), length("title_length")),
                &["meta_title"],
            ),
            ctx.judged(
                t(c::DESCRIPTION),
                with_length(meta("description"), length("description_length")),
                &["meta_description"],
            ),
            ctx.judged(t(c::CANONICAL), meta("canonical"), &["meta_canonical"]),
            ctx.judged(t(c::ROBOTS_META), meta("robots"), &["meta_robots"]),
            ctx.judged(t(c::VIEWPORT), meta("viewport"), &["meta_viewport"]),
            Check::info(t(c::CHARSET), meta("charset")),
            Check::info(t(c::KEYWORDS), meta("keywords")),
            Check::info(t(c::AUTHOR), meta("author")),
            Check::info(t(c::GENERATOR), meta("generator")),
            Check::info(t(c::THEME_COLOR), meta("theme_color")),
        ],
    }
}

fn outline(ctx: &Ctx) -> Vec<String> {
    fn walk(nodes: &[serde_json::Value], out: &mut Vec<String>) {
        for node in nodes {
            let level = field(node, "level").unwrap_or_default();
            out.push(format!(
                "H{level} {}",
                field(node, "text").unwrap_or_else(|| EMPTY.into())
            ));
            walk(super::super::ctx::list_at(node, "/children"), out);
        }
    }
    let mut out = Vec::new();
    walk(ctx.list("/headings/hierarchy"), &mut out);
    out
}

pub fn headings(ctx: &Ctx) -> Section {
    let h1 = ctx.count("/headings/h1_count");
    let texts: Vec<String> = ctx
        .list("/headings/h1_texts")
        .iter()
        .filter_map(|text| text.as_str().map(str::to_owned))
        .collect();
    let valid = ctx.flag("/headings/has_valid_hierarchy");
    let mut hierarchy = ctx.judged(t(c::HIERARCHY), yes_no(valid), &["headings_hierarchy"]);
    if valid == Some(false) && hierarchy.status == Status::Ok {
        hierarchy.status = Status::Attention;
    }
    let lines = outline(ctx);
    Section {
        title: t(c::HEADINGS_TITLE).into(),
        checks: vec![
            ctx.judged(t(c::H1_COUNT), h1, &["headings_h1"]),
            Check::info(t(c::H1_TEXT), (!texts.is_empty()).then(|| texts.join("; "))),
            hierarchy,
            Check::info(t(c::OUTLINE), (!lines.is_empty()).then(|| lines.join("; "))),
        ],
    }
}

pub fn content(ctx: &Ctx) -> Section {
    let stat = |key: &str| ctx.count(&format!("/content_stats/{key}"));
    let keywords: Vec<String> = ctx
        .list("/content_stats/top_keywords")
        .iter()
        .map(|item| {
            let word = field(item, "keyword").unwrap_or_default();
            tf(
                t(c::KEYWORD),
                &[&word, &field(item, "count").unwrap_or_default()],
            )
        })
        .collect();
    let readability = ctx.text("/content_stats/readability_label");
    let score = stat("readability_ease_score");
    Section {
        title: t(c::CONTENT_TITLE).into(),
        checks: vec![
            Check::info(t(c::WORDS), stat("word_count")),
            Check::info(t(c::SENTENCES), stat("sentence_count")),
            Check::info(
                t(c::READING_TIME),
                stat("reading_time_minutes").map(|m| tf(t(c::MINUTES), &[&m])),
            ),
            Check::info(
                t(c::READABILITY),
                readability.map(|label| {
                    tf(
                        t(c::READABILITY_VALUE),
                        &[&label, &score.unwrap_or_else(|| EMPTY.into())],
                    )
                }),
            ),
            Check::info(t(c::WORDS_PER_SENTENCE), stat("average_words_per_sentence")),
            Check::info(
                t(c::TEXT_RATIO),
                stat("text_ratio_percent").map(|v| format!("{v}%")),
            ),
            Check::info(
                t(c::TOP_KEYWORDS),
                (!keywords.is_empty()).then(|| keywords.join(", ")),
            ),
        ],
    }
}
