use super::super::check::{yes_no, Check, Section, Status};
use super::super::ctx::{field, Ctx};
use super::super::strings::{checks as c, report as s, t, tf};
use serde_json::Value;

pub fn structured_data(ctx: &Ctx) -> Section {
    let blocks = ctx.list("/structured_data");
    let mut checks = vec![Check::info(t(c::BLOCKS), Some(blocks.len().to_string()))];
    for block in blocks {
        let issues = super::super::ctx::list_at(block, "/validation_issues");
        let name = tf(
            t(c::BLOCK),
            &[
                &field(block, "data_type").unwrap_or_default(),
                &field(block, "format").unwrap_or_default(),
            ],
        );
        if issues.is_empty() {
            checks.push(Check::new(
                &name,
                Some(t(c::VALID).into()),
                Status::Ok,
                t(s::NO_ACTION),
            ));
        }
        for issue in issues {
            let advice =
                field(issue, "recommendation").unwrap_or_else(|| t(c::STRUCTURED_ADVICE).into());
            let message = field(issue, "message").unwrap_or_default();
            checks.push(Check::new(&name, Some(message), Status::Attention, &advice));
        }
    }
    Section {
        title: t(c::STRUCTURED_TITLE).into(),
        checks,
    }
}

pub fn social(ctx: &Ctx) -> Section {
    let og = |key: &str| ctx.text(&format!("/open_graph/{key}"));
    let tw = |key: &str| ctx.text(&format!("/twitter_card/{key}"));
    let core = |name: &str, value: Option<String>| {
        Check::required(name, value, &tf(t(c::ADD_TAG), &[name]))
    };
    Section {
        title: t(c::SOCIAL_TITLE).into(),
        checks: vec![
            core("og:title", og("og_title")),
            core("og:description", og("og_description")),
            core("og:image", og("og_image")),
            Check::info("og:type", og("og_type")),
            Check::info("og:url", og("og_url")),
            Check::info("og:site_name", og("og_site_name")),
            Check::info("og:locale", og("og_locale")),
            core("twitter:card", tw("twitter_card")),
            Check::info("twitter:title", tw("twitter_title")),
            Check::info("twitter:description", tw("twitter_description")),
            Check::info("twitter:image", tw("twitter_image")),
            Check::info("twitter:site", tw("twitter_site")),
            Check::info("twitter:creator", tw("twitter_creator")),
        ],
    }
}

fn finding_check(finding: &Value) -> Check {
    let status = if field(finding, "severity").as_deref() == Some("info") {
        Status::Info
    } else {
        Status::Attention
    };
    let name = field(finding, "message").unwrap_or_default();
    let advice = field(finding, "recommendation").unwrap_or_default();
    Check::new(&name, field(finding, "evidence"), status, &advice)
}

pub fn accessibility(ctx: &Ctx) -> Section {
    let count = |key: &str| ctx.count(&format!("/accessibility/{key}"));
    let landmarks: Vec<String> = ctx
        .list("/accessibility/landmarks")
        .iter()
        .map(|item| {
            tf(
                t(c::KEYWORD),
                &[
                    &field(item, "name").unwrap_or_default(),
                    &field(item, "count").unwrap_or_default(),
                ],
            )
        })
        .collect();
    let language = ctx.text("/accessibility/document_language");
    let mut checks = vec![
        ctx.judged(
            t(c::LANGUAGE),
            language,
            &["accessibility-document-language"],
        ),
        Check::info(
            t(c::LANDMARKS),
            (!landmarks.is_empty()).then(|| landmarks.join(", ")),
        ),
        Check::info(t(c::ARIA), count("aria_attribute_count")),
        Check::info(t(c::FORM_CONTROLS), count("form_control_count")),
        ctx.judged(
            t(c::UNLABELED),
            count("unlabeled_form_control_count"),
            &["accessibility-form-controls"],
        ),
        Check::info(t(c::HIDDEN_CONTROLS), count("hidden_form_control_count")),
    ];
    let findings = ctx.list("/accessibility/findings");
    checks.extend(findings.iter().map(finding_check));
    for item in ctx.list("/accessibility/manual_review_items") {
        checks.push(Check::info(t(c::MANUAL), item.as_str().map(str::to_owned)));
    }
    Section {
        title: t(c::A11Y_TITLE).into(),
        checks,
    }
}

pub fn amp(ctx: &Ctx) -> Section {
    let urls: Vec<String> = ctx
        .list("/amp/amphtml_urls")
        .iter()
        .filter_map(|url| url.as_str().map(str::to_owned))
        .collect();
    let mut checks = vec![
        Check::info(t(c::AMP_DETECTED), yes_no(ctx.flag("/amp/detected"))),
        Check::info(t(c::AMP_DOCUMENT), yes_no(ctx.flag("/amp/is_amp_document"))),
        Check::info(t(c::AMP_URLS), (!urls.is_empty()).then(|| urls.join(", "))),
        Check::info(t(c::AMP_CANONICAL), ctx.text("/amp/canonical_url")),
        Check::info(t(c::AMP_COVERAGE), ctx.text("/amp/coverage")),
    ];
    checks.extend(ctx.list("/amp/findings").iter().map(finding_check));
    for item in ctx.list("/amp/unchecked") {
        checks.push(Check::info(
            t(c::NOT_VERIFIED),
            item.as_str().map(str::to_owned),
        ));
    }
    Section {
        title: t(c::AMP_TITLE).into(),
        checks,
    }
}
