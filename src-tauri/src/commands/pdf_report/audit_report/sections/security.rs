use super::super::check::{yes_no, Check, Section, Status};
use super::super::ctx::{field, Ctx};
use super::super::strings::{checks as c, report as s, t};

pub fn security_headers(ctx: &Ctx) -> Section {
    let header = |key: &str| ctx.text(&format!("/security_headers/{key}"));
    let judged = |name: &str, key: &str, prefix: &str| ctx.judged(name, header(key), &[prefix]);
    Section {
        title: c::SECURITY_TITLE.into(),
        checks: vec![
            Check::info(
                c::SECURITY_SCORE,
                ctx.count("/security_headers/score")
                    .map(|v| format!("{v} / 100")),
            ),
            judged(
                "Strict-Transport-Security",
                "strict_transport_security",
                "security_hsts",
            ),
            judged(
                "Content-Security-Policy",
                "content_security_policy",
                "security_csp_",
            ),
            judged(
                "CSP report-only",
                "content_security_policy_report_only",
                "security_csp_report",
            ),
            judged("X-Frame-Options", "x_frame_options", "security_xframe"),
            judged(
                "X-Content-Type-Options",
                "x_content_type_options",
                "security_xcontent",
            ),
            judged("Referrer-Policy", "referrer_policy", "security_referrer"),
            judged(
                "Permissions-Policy",
                "permissions_policy",
                "security_permissions",
            ),
            judged(
                "Cross-Origin-Opener-Policy",
                "cross_origin_opener_policy",
                "security_coop",
            ),
            Check::info(
                "Cross-Origin-Resource-Policy",
                header("cross_origin_resource_policy"),
            ),
            judged("Server", "server", "security_server"),
            judged("X-Powered-By", "x_powered_by", "security_powered"),
        ],
    }
}

fn cookie_check(ctx: &Ctx, cookie: &serde_json::Value) -> Check {
    let flag = |key: &str| cookie.get(key).and_then(serde_json::Value::as_bool);
    let same_site = field(cookie, "same_site");
    let healthy =
        flag("secure") == Some(true) && flag("http_only") == Some(true) && same_site.is_some();
    let value = t(
        c::COOKIE_VALUE,
        &[
            &yes_no(flag("secure")).unwrap_or_default(),
            &yes_no(flag("http_only")).unwrap_or_default(),
            &same_site.unwrap_or_else(|| s::NOT_SET.into()),
        ],
    );
    let name = t(c::COOKIE, &[&field(cookie, "name").unwrap_or_default()]);
    if healthy {
        return Check::new(&name, Some(value), Status::Ok, s::NO_ACTION);
    }
    let advice = ctx.issue(&["cookie_"]).map(|f| f.recommendation.clone());
    Check::new(
        &name,
        Some(value),
        Status::Attention,
        &advice.unwrap_or_else(|| c::COOKIE_ADVICE.into()),
    )
}

pub fn transport(ctx: &Ctx) -> Section {
    let mixed = ctx.list("/transport_security/mixed_content_urls");
    let mut checks = vec![
        ctx.judged(
            c::HTTPS,
            yes_no(ctx.flag("/transport_security/https")),
            &["transport_http"],
        ),
        Check::info(c::SCHEME, ctx.text("/transport_security/scheme")),
        ctx.counted(
            c::MIXED,
            mixed.len().to_string(),
            mixed.len(),
            &["transport_mixed"],
            c::FIX_MIXED,
        ),
    ];
    let cookies = ctx.list("/transport_security/cookies");
    checks.extend(cookies.iter().map(|cookie| cookie_check(ctx, cookie)));
    if cookies.is_empty() {
        checks.push(Check::info(c::COOKIES, Some(c::NO_COOKIES.into())));
    }
    checks.push(Check::info(
        c::TLS,
        ctx.text("/transport_security/tls_coverage"),
    ));
    Section {
        title: c::TRANSPORT_TITLE.into(),
        checks,
    }
}
