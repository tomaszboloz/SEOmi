use super::super::check::{Check, Section};
use super::super::ctx::{field, Ctx};
use super::super::strings::{checks as c, t, tf};

fn unit(value: Option<String>, template: &str) -> Option<String> {
    value.map(|value| tf(template, &[&value]))
}

pub fn performance(ctx: &Ctx) -> Section {
    let perf = |key: &str| ctx.count(&format!("/http_performance/{key}"));
    Section {
        title: t(c::PERF_TITLE).into(),
        checks: vec![
            ctx.judged(
                t(c::HTTP_STATUS),
                ctx.count("/http_status"),
                &["performance_http"],
            ),
            ctx.judged(
                t(c::RESPONSE_TIME),
                unit(ctx.count("/response_time_ms"), t(c::MS)),
                &["performance_response"],
            ),
            Check::info(
                t(c::HEADERS_TIME),
                unit(perf("response_headers_ms"), t(c::MS)),
            ),
            Check::info(t(c::BODY_TIME), unit(perf("body_read_ms"), t(c::MS))),
            Check::info(t(c::TOTAL_TIME), unit(perf("total_request_ms"), t(c::MS))),
            Check::info(
                t(c::BODY_BYTES),
                unit(perf("decoded_body_bytes"), t(c::BYTES)),
            ),
            Check::info(
                t(c::LENGTH_HEADER),
                unit(perf("content_length_header_bytes"), t(c::BYTES)),
            ),
            Check::info(t(c::REDIRECT_COUNT), perf("redirect_hops")),
            Check::info(t(c::METHOD), ctx.text("/http_performance/method")),
            Check::info(t(c::MEASURED_AT), ctx.text("/http_performance/measured_at")),
            Check::info(t(c::SCOPE), ctx.text("/http_performance/scope")),
        ],
    }
}

pub fn technical(ctx: &Ctx) -> Section {
    let tech = |key: &str| ctx.text(&format!("/technical/{key}"));
    let joined = |pointer: &str, build: &dyn Fn(&serde_json::Value) -> String| {
        let items: Vec<String> = ctx.list(pointer).iter().map(build).collect();
        (!items.is_empty()).then(|| items.join("; "))
    };
    let signal = |item: &serde_json::Value| {
        let version = field(item, "version")
            .map(|v| format!(" {v}"))
            .unwrap_or_default();
        tf(
            t(c::SIGNAL),
            &[
                &field(item, "name").unwrap_or_default(),
                &version,
                &field(item, "category").unwrap_or_default(),
                &field(item, "confidence").unwrap_or_default(),
            ],
        )
    };
    let hreflang = |item: &serde_json::Value| {
        tf(
            t(c::HREFLANG),
            &[
                &field(item, "hreflang").unwrap_or_default(),
                &field(item, "href").unwrap_or_default(),
            ],
        )
    };
    Section {
        title: t(c::TECH_TITLE).into(),
        checks: vec![
            Check::info(t(c::CONTENT_TYPE), tech("content_type")),
            Check::info(t(c::SERVER), tech("server")),
            Check::info(t(c::FAVICON), tech("favicon")),
            Check::info(t(c::ROBOTS_TXT), tech("robots_txt_url")),
            Check::info(t(c::SITEMAP), tech("sitemap_url")),
            Check::info(
                t(c::HREFLANG_TAGS),
                joined("/technical/hreflang_tags", &hreflang),
            ),
            Check::info(
                t(c::TECH_SIGNALS),
                joined("/technical/technology_signals", &signal),
            ),
        ],
    }
}
