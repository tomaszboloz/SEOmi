use super::super::check::{yes_no, Check, Section, Status};
use super::super::ctx::{field, Ctx};
use super::super::strings::{checks as c, t};
use crate::commands::pdf_report::layout::text::EMPTY;

pub fn redirects(ctx: &Ctx) -> Section {
    let chain = ctx.list("/redirect_chain");
    let mut checks = vec![ctx.judged(
        c::REDIRECT_HOPS,
        Some(chain.len().to_string()),
        &["performance_redirect"],
    )];
    for (index, hop) in chain.iter().enumerate() {
        let status = field(hop, "status_code").unwrap_or_default();
        let to = field(hop, "location").unwrap_or_else(|| EMPTY.into());
        let value = t(
            c::HOP_VALUE,
            &[&status, &field(hop, "url").unwrap_or_default(), &to],
        );
        checks.push(Check::info(
            &t(c::HOP, &[&(index + 1).to_string()]),
            Some(value),
        ));
    }
    Section {
        title: c::REDIRECT_TITLE.into(),
        checks,
    }
}

pub fn indexability(ctx: &Ctx) -> Section {
    let status = ctx.text("/indexability/status");
    let reasons: Vec<String> = ctx
        .list("/indexability/reasons")
        .iter()
        .filter_map(|r| r.as_str().map(str::to_owned))
        .collect();
    let mut verdict = match status.as_deref() {
        Some("indexable") => Check::new(
            c::INDEX_STATUS,
            status,
            Status::Ok,
            super::super::strings::report::NO_ACTION,
        ),
        _ => Check::new(
            c::INDEX_STATUS,
            status,
            Status::Attention,
            &reasons.join(" "),
        ),
    };
    if verdict.value == crate::commands::pdf_report::layout::text::EMPTY {
        verdict.status = Status::Info;
    }
    let target = ctx.count("/indexability/canonical_target_status");
    Section {
        title: c::INDEX_TITLE.into(),
        checks: vec![
            verdict,
            ctx.judged(
                c::ROBOTS_META,
                ctx.text("/indexability/meta_robots"),
                &["meta_robots"],
            ),
            ctx.judged(
                c::X_ROBOTS,
                ctx.text("/indexability/x_robots_tag"),
                &["indexability_xrobots"],
            ),
            ctx.judged(
                c::CANONICAL,
                ctx.text("/indexability/canonical"),
                &["meta_canonical"],
            ),
            Check::info(
                c::CANONICAL_MATCH,
                yes_no(ctx.flag("/indexability/canonical_matches_final_url")),
            ),
            Check::info(
                c::CANONICAL_CHECKED,
                yes_no(ctx.flag("/indexability/canonical_target_checked")),
            ),
            Check::info(c::CANONICAL_STATUS, target),
            Check::info(
                c::CANONICAL_ERROR,
                ctx.text("/indexability/canonical_target_check_error"),
            ),
        ],
    }
}
