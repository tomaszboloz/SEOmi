//! Detail sections: one per audit area present in the data.

mod extras;
mod index;
mod media;
mod page;
mod perf;
mod phrase;
mod security;

use super::check::Section;
use super::ctx::Ctx;

/// Sections whose audit keys exist; a key that is absent or null hides the area.
pub fn build(ctx: &Ctx) -> Vec<Section> {
    let all: Vec<(&[&str], Section)> = vec![
        (&["meta_tags"], page::meta_tags(ctx)),
        (&["headings"], page::headings(ctx)),
        (&["content_stats"], page::content(ctx)),
        (&["images"], media::images(ctx)),
        (&["links"], media::links(ctx)),
        (&["redirect_chain"], index::redirects(ctx)),
        (&["indexability"], index::indexability(ctx)),
        (&["security_headers"], security::security_headers(ctx)),
        (&["transport_security"], security::transport(ctx)),
        (&["structured_data"], extras::structured_data(ctx)),
        (&["open_graph", "twitter_card"], extras::social(ctx)),
        (&["accessibility"], extras::accessibility(ctx)),
        (&["amp"], extras::amp(ctx)),
        (
            &["http_performance", "response_time_ms"],
            perf::performance(ctx),
        ),
        (&["technical"], perf::technical(ctx)),
    ];
    all.into_iter()
        .filter(|(keys, _)| {
            keys.iter()
                .any(|key| ctx.audit.get(key).is_some_and(|value| !value.is_null()))
        })
        .map(|(_, section)| section)
        .chain(phrase::sections(ctx))
        .collect()
}
